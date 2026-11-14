import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ensureWorkspace, listWorkspaceFiles, projectWorkspace } from "../tools/workspace-tools";
import { upsertProjectFile } from "../domain/project-service";

const execFileAsync = promisify(execFile);
const gitEnv = () => ({ ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", HOME: projectWorkspace(0) });
const refPattern = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,159}$/;
const safeRef = (value: string) => { if (!refPattern.test(value) || value.includes("..") || value.startsWith("-") || value.endsWith("/")) throw new Error("Unsafe Git ref"); return value; };
export function validateGitRemote(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid public Git repository URL"); }
  const allowedHosts = new Set(["github.com", "gitlab.com", "bitbucket.org"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("Repository import currently supports credential-free HTTPS URLs from GitHub, GitLab, and Bitbucket only");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments.some(segment => segment === "." || segment === ".." || !/^[A-Za-z0-9_.-]+$/.test(segment))) {
    throw new Error("Repository URL must identify a valid owner and repository path");
  }
  return url.toString().replace(/\/$/, "");
}
const safeRemote = validateGitRemote;

export async function runGit(projectId: number, args: string[], timeout = 60_000) { const cwd = await ensureWorkspace(projectId); const result = await execFileAsync("git", ["--no-pager", ...args], { cwd, timeout, maxBuffer: 400_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" } }); return `${result.stdout}${result.stderr}`.trim(); }
export async function gitStatus(projectId: number) { return { output: await runGit(projectId, ["status", "--short", "--branch"]), branch: (await runGit(projectId, ["branch", "--show-current"])) || "HEAD detached", head: await runGit(projectId, ["rev-parse", "HEAD"]).catch(() => null) }; }
export async function gitInit(projectId: number) { const workspace = await ensureWorkspace(projectId); try { await fs.access(path.join(workspace, ".git")); return { initialized: false, status: await gitStatus(projectId) }; } catch { await runGit(projectId, ["init", "--initial-branch=main"]); return { initialized: true, status: await gitStatus(projectId) }; } }
export async function gitHistory(projectId: number, limit = 20) { return runGit(projectId, ["log", `-${Math.min(Math.max(limit, 1), 100)}`, "--oneline", "--decorate"]); }
export async function gitDiff(projectId: number, ref?: string) { return runGit(projectId, ref ? ["diff", safeRef(ref)] : ["diff"]); }
export async function gitCreateBranch(projectId: number, branch: string) { return runGit(projectId, ["switch", "-c", safeRef(branch)]); }
export async function gitSwitchBranch(projectId: number, branch: string) { return runGit(projectId, ["switch", safeRef(branch)]); }
export async function gitMerge(projectId: number, branch: string) { return runGit(projectId, ["merge", "--no-edit", safeRef(branch)]); }
export async function gitRestore(projectId: number, filePath?: string) { return runGit(projectId, filePath ? ["restore", "--", safeRef(filePath)] : ["restore", "--staged", "."]); }
export async function gitRevert(projectId: number, sha: string) { return runGit(projectId, ["revert", "--no-edit", safeRef(sha)]); }
export async function gitTag(projectId: number, tag: string, sha?: string) { const args = ["tag", safeRef(tag)]; if (sha) args.push(safeRef(sha)); return runGit(projectId, args); }
export async function gitFetch(projectId: number) { return runGit(projectId, ["fetch", "--all", "--prune"], 120_000); }
export async function gitPull(projectId: number) { return runGit(projectId, ["pull", "--ff-only"], 120_000); }
export async function gitPush(projectId: number, remote = "origin", branch?: string) { return runGit(projectId, ["push", safeRef(remote), branch ? safeRef(branch) : "HEAD"], 120_000); }

const secretPath = /(^|\/)(\.env(?:\.|$)|.*\.(pem|key|p12|pfx)|id_rsa|credentials(?:\.json)?)(\/|$)/i;
const secretText = /(AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]\s*["'][^"']+["'])/i;
export function repositoryFileIndexSafety(filePath: string, content: string) {
  if (secretPath.test(filePath)) return { safe: false, reason: "sensitive_path" as const };
  if (secretText.test(content)) return { safe: false, reason: "credential_pattern" as const };
  return { safe: true, reason: null };
}
export async function inspectCommitSafety(projectId: number) { const files = await listWorkspaceFiles(projectId); const sensitivePaths = files.filter(file => secretPath.test(file.path)).map(file => file.path); const missingGitignore = !files.some(file => file.path === ".gitignore"); const textFindings: string[] = []; for (const file of files.filter(file => file.kind === "file" && file.size <= 60_000)) { try { const content = await fs.readFile(path.join(projectWorkspace(projectId), file.path), "utf8"); if (secretText.test(content)) textFindings.push(file.path); } catch { /* unreadable files are handled by Git itself */ } } return { safe: sensitivePaths.length === 0 && textFindings.length === 0 && !missingGitignore, sensitivePaths, textFindings, missingGitignore, recommendation: sensitivePaths.length || textFindings.length ? "Remove secrets before committing." : missingGitignore ? "Add a .gitignore before committing." : "Ready for a reviewed commit." }; }
export async function gitCommit(projectId: number, message: string) { if (!message.trim() || message.length > 180) throw new Error("Commit message must be 1–180 characters"); const safety = await inspectCommitSafety(projectId); if (!safety.safe) throw new Error(safety.recommendation); const name = await runGit(projectId, ["config", "user.name"]).catch(() => ""); const email = await runGit(projectId, ["config", "user.email"]).catch(() => ""); if (!name) await runGit(projectId, ["config", "user.name", "VOH STUDIO"]); if (!email) await runGit(projectId, ["config", "user.email", "voh-studio@local.invalid"]); await runGit(projectId, ["add", "-A"]); const staged = await runGit(projectId, ["diff", "--cached", "--name-only"]); if (!staged) throw new Error("There are no changes to commit"); const stagedDiff = await runGit(projectId, ["diff", "--cached"]); if (secretText.test(stagedDiff)) { await runGit(projectId, ["reset" ]); throw new Error("Sensitive content detected in staged changes; commit was not created."); } const output = await runGit(projectId, ["commit", "-m", message]); return { output, safety, head: await runGit(projectId, ["rev-parse", "HEAD"]), files: staged.split("\n").filter(Boolean) }; }
export async function cloneRepository(projectId: number, url: string, destination = "imported") {
  const remote = safeRemote(url);
  const root = await ensureWorkspace(projectId);
  const importToRoot = destination === ".";
  const safeDestination = importToRoot ? "." : safeRef(destination);
  const target = importToRoot ? root : path.resolve(root, safeDestination);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error("Clone destination is outside the project workspace");
  if (importToRoot) {
    const existing = await listWorkspaceFiles(projectId);
    if (existing.length) throw new Error("Import into the project root requires an empty workspace. Use a new project or import into a subfolder.");
  } else {
    await fs.access(target).then(() => { throw new Error("Clone destination already exists"); }).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
  }
  await execFileAsync("git", ["clone", "--", remote, target], { cwd: root, timeout: 180_000, maxBuffer: 400_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" } });
  const files = (await listWorkspaceFiles(projectId)).filter(file => file.kind === "file" && (importToRoot || file.path.startsWith(safeDestination + path.sep)));
  let indexed = 0;
  let skippedLargeFiles = 0;
  let skippedSensitiveFiles = 0;
  for (const file of files) {
    if (file.size > 60_000) { skippedLargeFiles++; continue; }
    const absolute = path.join(root, file.path);
    const content = await fs.readFile(absolute, "utf8");
    if (!repositoryFileIndexSafety(file.path, content).safe) { skippedSensitiveFiles++; continue; }
    await upsertProjectFile({ projectId, path: file.path, language: path.extname(file.path).slice(1) || undefined, contentHash: crypto.createHash("sha256").update(content).digest("hex"), size: Buffer.byteLength(content), content, lastOperation: "repository-import" });
    indexed++;
  }
  return { destination: safeDestination, status: "cloned" as const, indexedFiles: indexed, skippedLargeFiles, skippedSensitiveFiles };
}
export async function draftReleaseNotes(projectId: number) { const history = await gitHistory(projectId, 12); const stat = await runGit(projectId, ["diff", "HEAD~1", "--stat"]).catch(() => "No previous commit available; release notes reflect the current repository state."); return { notes: `## Changes\n${history ? history.split("\n").map(line => `- ${line}`).join("\n") : "- No commit history available."}\n\n## File impact\n${stat}`, source: "git-history-and-diff" as const }; }

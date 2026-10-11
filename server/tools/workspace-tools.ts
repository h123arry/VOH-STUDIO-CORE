import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { upsertProjectFile } from "../domain/project-service";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(process.env.VOH_WORKSPACE_ROOT ?? path.join(process.cwd(), "workspace-data"));
const MAX_FILE_BYTES = 60_000;
const SAFE_SCRIPT = /^(node|pnpm|vite|tsc|echo)\s+[A-Za-z0-9_./:@=-]+(?:\s+[A-Za-z0-9_./:@=-]+)*$/;
const SAFE_GIT = /^(status|diff|log(?:\s+--oneline)?|rev-parse(?:\s+HEAD)?)$/;

const safePath = (relativePath: string) => {
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, "");
  if (!normalized || normalized === "." || normalized.split(path.sep).includes("..")) throw new Error("Path is outside the project workspace");
  return normalized;
};
const assertAbsoluteInside = (workspace: string, absolute: string) => { if (absolute !== workspace && !absolute.startsWith(`${workspace}${path.sep}`)) throw new Error("Path is outside the project workspace"); };
const assertRealInside = async (workspace: string, absolute: string) => { const real = await fs.realpath(absolute); if (real !== workspace && !real.startsWith(`${workspace}${path.sep}`)) throw new Error("Resolved path is outside the project workspace"); return real; };

export const projectWorkspace = (projectId: number) => path.join(ROOT, `project-${projectId}`);
export async function ensureWorkspace(projectId: number) { const workspace = projectWorkspace(projectId); await fs.mkdir(workspace, { recursive: true }); return workspace; }

export async function listWorkspaceFiles(projectId: number) {
  const workspace = await ensureWorkspace(projectId); const results: Array<{ path: string; size: number; kind: "file" | "directory" }> = [];
  const walk = async (current: string) => { for (const entry of await fs.readdir(current, { withFileTypes: true })) { if (entry.name === "node_modules" || entry.name === ".git" || entry.isSymbolicLink()) continue; const absolute = path.join(current, entry.name); const relative = path.relative(workspace, absolute); if (entry.isDirectory()) { results.push({ path: relative, size: 0, kind: "directory" }); await walk(absolute); } else { const stat = await fs.stat(absolute); results.push({ path: relative, size: stat.size, kind: "file" }); } } };
  await walk(workspace); return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readWorkspaceFile(projectId: number, relativePath: string) { const workspace = await ensureWorkspace(projectId); const safe = safePath(relativePath); const absolute = path.join(workspace, safe); assertAbsoluteInside(workspace, absolute); const link = await fs.lstat(absolute); if (link.isSymbolicLink()) throw new Error("Symbolic links are not readable in the workspace"); await assertRealInside(workspace, absolute); if (link.size > MAX_FILE_BYTES) throw new Error("File is too large to open in the studio"); return fs.readFile(absolute, "utf8"); }
export async function readWorkspaceAsset(projectId: number, relativePath: string) { const workspace = await ensureWorkspace(projectId); const safe = safePath(relativePath); const absolute = path.join(workspace, safe); assertAbsoluteInside(workspace, absolute); const link = await fs.lstat(absolute); if (link.isSymbolicLink()) throw new Error("Symbolic links are not served in preview"); await assertRealInside(workspace, absolute); if (link.size > 2_000_000) throw new Error("Preview asset exceeds the size limit"); return { path: safe, content: await fs.readFile(absolute), size: link.size }; }

export async function writeWorkspaceFile(projectId: number, relativePath: string, content: string, lastOperation = "write") {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new Error("File exceeds the workspace size limit");
  const workspace = await ensureWorkspace(projectId); const safe = safePath(relativePath); const absolute = path.join(workspace, safe); assertAbsoluteInside(workspace, absolute); await fs.mkdir(path.dirname(absolute), { recursive: true }); const parent = await fs.realpath(path.dirname(absolute)); if (parent !== workspace && !parent.startsWith(`${workspace}${path.sep}`)) throw new Error("Resolved parent is outside the project workspace"); const existing = await fs.lstat(absolute).catch(() => null); if (existing?.isSymbolicLink()) throw new Error("Symbolic links cannot be overwritten");
  await fs.writeFile(absolute, content, "utf8"); await upsertProjectFile({ projectId, path: safe, language: path.extname(safe).slice(1) || undefined, contentHash: crypto.createHash("sha256").update(content).digest("hex"), size: Buffer.byteLength(content), content, lastOperation }); return { path: safe, size: Buffer.byteLength(content) };
}

export async function inspectWorkspace(projectId: number) { const files = await listWorkspaceFiles(projectId); return { files, hasPackageManifest: Boolean(files.find(file => file.path === "package.json")), summary: `${files.filter(file => file.kind === "file").length} files indexed` }; }

async function validateCommand(cwd: string, command: string) {
  const parts = command.trim().split(/\s+/); const executable = parts[0]; const args = parts.slice(1); if (!executable) throw new Error("Empty workspace command");
  if (executable === "pnpm") {
    if (args[0] === "install") { const packagePath = path.join(cwd, "package.json"); const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")); const dependencyCount = Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}), ...(packageJson.optionalDependencies ?? {}) }).length; if (dependencyCount > 0) throw new Error("Dependency installation is blocked until packages pass the workspace allowlist; no unreviewed package lifecycle scripts are executed."); return { executable, args };
    }
    if (!["build", "test", "start", "lint", "typecheck"].includes(args[0] ?? "")) throw new Error("Only declared build/test/start/lint/typecheck scripts may run");
    const packageJson = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")); const script = packageJson.scripts?.[args[0]]; if (typeof script !== "string" || !SAFE_SCRIPT.test(script)) throw new Error("Package script is not on the safe workspace command policy"); return { executable, args: [args[0]] };
  }
  if (executable === "git" && SAFE_GIT.test(args.join(" "))) return { executable, args };
  if ((executable === "node" || executable === "python" || executable === "python3") && args.length === 1 && /^[A-Za-z0-9_./-]+\.(mjs|js|py)$/.test(args[0])) return { executable, args };
  throw new Error("Command is not on the allowed workspace command list");
}

export async function runWorkspaceCommand(projectId: number, command: string, timeout = 20_000) {
  const cwd = await ensureWorkspace(projectId); const started = Date.now();
  try { const safe = await validateCommand(cwd, command); const result = await execFileAsync(safe.executable, safe.args, { cwd, timeout, maxBuffer: 240_000, killSignal: "SIGKILL", env: { PATH: process.env.PATH, HOME: cwd, XDG_CONFIG_HOME: path.join(cwd, ".config"), npm_config_cache: path.join(cwd, ".npm-cache"), NODE_ENV: "test" } }); return { status: "passed" as const, exitCode: 0, output: `${result.stdout}${result.stderr}`.trim().slice(-20_000), durationMs: Date.now() - started }; }
  catch (error) { const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string }; return { status: "failed" as const, exitCode: typeof failure.code === "number" ? failure.code : 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}${failure.message ?? ""}`.trim().slice(-20_000), durationMs: Date.now() - started }; }
}
export async function installWorkspaceDependencies(projectId: number) { return runWorkspaceCommand(projectId, "pnpm install --lockfile=false", 120_000); }

export async function snapshotWorkspace(projectId: number, snapshotId: string) { const workspace = await ensureWorkspace(projectId); const snapshotRoot = path.join(ROOT, "snapshots", `project-${projectId}`, snapshotId); await fs.mkdir(snapshotRoot, { recursive: true }); const files = (await listWorkspaceFiles(projectId)).filter(file => file.kind === "file"); for (const file of files) { const source = path.join(workspace, file.path); const target = path.join(snapshotRoot, file.path); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); } return { snapshotPath: path.relative(ROOT, snapshotRoot), fileCount: files.length }; }

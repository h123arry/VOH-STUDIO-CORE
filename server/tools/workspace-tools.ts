import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deleteProjectFile, renameProjectFile, upsertProjectFile } from "../domain/project-service";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(process.env.VOH_WORKSPACE_ROOT ?? path.join(process.cwd(), "workspace-data"));
const MAX_FILE_BYTES = 60_000;
const SAFE_SCRIPT = /^(node|pnpm|vite|tsc|echo)\s+[A-Za-z0-9_./:@=-]+(?:\s+[A-Za-z0-9_./:@=-]+)*$/;
const SAFE_GIT = /^(status|diff|log(?:\s+--oneline)?|rev-parse(?:\s+HEAD)?)$/;

export function normalizeWorkspacePath(relativePath: string) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes(String.fromCharCode(0))) {
    throw new Error("Path is outside the project workspace");
  }
  // Treat both slash styles as separators so a path cannot become traversal
  // when a workspace is moved between POSIX and Windows hosts.
  const portable = relativePath.replace(/\\/g, "/");
  if (portable.startsWith("/") || /^[a-zA-Z]:/.test(portable) || portable.startsWith("//")) {
    throw new Error("Path is outside the project workspace");
  }
  const segments = portable.split("/");
  if (segments.some(segment => segment === "..")) {
    throw new Error("Path is outside the project workspace");
  }
  const normalized = path.posix.normalize(portable);
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Path is outside the project workspace");
  }
  return normalized.split("/").join(path.sep);
}

const safePath = normalizeWorkspacePath;
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

export async function writeWorkspaceFile(projectId: number, relativePath: string, content: string, lastOperation = "write", createOnly = false) {
  const size = Buffer.byteLength(content, "utf8");
  if (size > MAX_FILE_BYTES) throw new Error("File exceeds the workspace size limit");

  const workspace = await ensureWorkspace(projectId);
  const safe = safePath(relativePath);
  const absolute = path.join(workspace, safe);
  assertAbsoluteInside(workspace, absolute);

  // Walk each parent component instead of trusting recursive mkdir/realpath.
  // This rejects symlinked directories even when they point elsewhere inside
  // the workspace, keeping writes predictable and preventing workspace paths from traversing symlinked directories.
  const parentSegments = path.dirname(safe).split(path.sep).filter(Boolean);
  let parent = workspace;
  for (const segment of parentSegments) {
    parent = path.join(parent, segment);
    const entry = await fs.lstat(parent).catch(() => null);
    if (entry?.isSymbolicLink()) throw new Error("Symbolic links are not allowed in workspace paths");
    if (entry && !entry.isDirectory()) throw new Error("Workspace parent path is not a directory");
    if (!entry) await fs.mkdir(parent);
    const realParent = await fs.realpath(parent);
    if (realParent !== workspace && !realParent.startsWith(`${workspace}${path.sep}`)) {
      throw new Error("Resolved parent is outside the project workspace");
    }
  }

  const existing = await fs.lstat(absolute).catch(() => null);
  if (existing?.isSymbolicLink()) throw new Error("Symbolic links cannot be overwritten");
  if (existing && !existing.isFile()) throw new Error("Only regular workspace files can be replaced");
  if (createOnly && existing) throw new Error("A file already exists at this path");

  // Write beside the destination, then rename into place. Readers see either
  // the previous complete file or the new complete file, never a partial save.
  const temporary = path.join(parent, `.voh-write-${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: existing ? existing.mode & 0o777 : 0o600 });
    if (createOnly) {
      // Hard-link creation is atomic and fails if another writer created the path.
      await fs.link(temporary, absolute);
      await fs.rm(temporary, { force: true });
    } else {
      await fs.rename(temporary, absolute);
    }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }

  await upsertProjectFile({
    projectId,
    path: safe,
    language: path.extname(safe).slice(1) || undefined,
    contentHash: crypto.createHash("sha256").update(content).digest("hex"),
    size,
    content,
    lastOperation,
  });
  return { path: safe, size };
}

export async function createWorkspaceFile(projectId: number, relativePath: string, content = "") {
  return writeWorkspaceFile(projectId, relativePath, content, "manual-create", true);
}

export async function renameWorkspaceFile(projectId: number, oldRelativePath: string, newRelativePath: string) {
  const workspace = await ensureWorkspace(projectId);
  const oldSafe = safePath(oldRelativePath);
  const newSafe = safePath(newRelativePath);
  if (oldSafe === newSafe) return { oldPath: oldSafe, path: newSafe, renamed: false };
  const source = path.join(workspace, oldSafe);
  const destination = path.join(workspace, newSafe);
  assertAbsoluteInside(workspace, source);
  assertAbsoluteInside(workspace, destination);
  const sourceEntry = await fs.lstat(source);
  if (sourceEntry.isSymbolicLink()) throw new Error("Symbolic links cannot be renamed through the workspace editor");
  if (!sourceEntry.isFile()) throw new Error("Only regular files can be renamed through the workspace editor");
  await assertRealInside(workspace, source);
  const parentSegments = path.dirname(newSafe).split(path.sep).filter(Boolean);
  let parent = workspace;
  for (const segment of parentSegments) {
    parent = path.join(parent, segment);
    const entry = await fs.lstat(parent).catch(() => null);
    if (entry?.isSymbolicLink()) throw new Error("Symbolic links are not allowed in workspace paths");
    if (entry && !entry.isDirectory()) throw new Error("Workspace parent path is not a directory");
    if (!entry) await fs.mkdir(parent);
    const realParent = await fs.realpath(parent);
    if (realParent !== workspace && !realParent.startsWith(`${workspace}${path.sep}`)) throw new Error("Resolved parent is outside the project workspace");
  }
  await fs.link(source, destination);
  try { await fs.unlink(source); } catch (error) { await fs.unlink(destination).catch(() => undefined); throw error; }
  await renameProjectFile(projectId, oldSafe, newSafe);
  return { oldPath: oldSafe, path: newSafe, renamed: true };
}

export async function deleteWorkspaceFile(projectId: number, relativePath: string) {
  const workspace = await ensureWorkspace(projectId);
  const safe = safePath(relativePath);
  const absolute = path.join(workspace, safe);
  assertAbsoluteInside(workspace, absolute);
  const entry = await fs.lstat(absolute);
  if (entry.isSymbolicLink()) throw new Error("Symbolic links cannot be deleted through the workspace editor");
  if (!entry.isFile()) throw new Error("Only regular files can be deleted through the workspace editor");
  await assertRealInside(workspace, absolute);
  await fs.unlink(absolute);
  await deleteProjectFile(projectId, safe);
  return { path: safe, deleted: true };
}

export async function inspectWorkspace(projectId: number) { const files = await listWorkspaceFiles(projectId); return { files, hasPackageManifest: Boolean(files.find(file => file.path === "package.json")), summary: `${files.filter(file => file.kind === "file").length} files indexed` }; }

async function assertWorkspaceScriptPath(cwd: string, scriptPath: string) {
  if (path.isAbsolute(scriptPath) || scriptPath.split(/[\\/]/).includes("..")) {
    throw new Error("Workspace scripts must stay inside the project directory");
  }
  const absolute = path.resolve(cwd, scriptPath);
  if (absolute !== cwd && !absolute.startsWith(`${cwd}${path.sep}`)) {
    throw new Error("Workspace scripts must stay inside the project directory");
  }
  const relative = path.relative(cwd, absolute);
  let current = cwd;
  for (const segment of path.dirname(relative).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error("Workspace scripts cannot traverse symbolic links");
    }
  }
  const entry = await fs.lstat(absolute);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("Workspace script must be a regular file");
  }
  await assertRealInside(cwd, absolute);
}

function rejectCommandPathTraversal(tokens: string[]) {
  for (const token of tokens) {
    const value = token.split("=").slice(1).join("=") || token;
    if (path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) {
      throw new Error("Workspace commands cannot reference paths outside the project directory");
    }
  }
}

async function validateCommand(cwd: string, command: string) {
  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
  const args = parts.slice(1);
  if (!executable) throw new Error("Empty workspace command");
  rejectCommandPathTraversal(args);

  if (executable === "pnpm") {
    if (args[0] === "install") {
      const packagePath = path.join(cwd, "package.json");
      const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
      const dependencyCount = Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}), ...(packageJson.optionalDependencies ?? {}) }).length;
      if (dependencyCount > 0) throw new Error("Dependency installation is blocked until packages pass the workspace allowlist; no unreviewed package lifecycle scripts are executed.");
      return { executable, args };
    }
    if (!["build", "test", "start", "lint", "typecheck"].includes(args[0] ?? "")) throw new Error("Only declared build/test/start/lint/typecheck scripts may run");
    const packageJson = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    const script = packageJson.scripts?.[args[0]];
    if (typeof script !== "string" || !SAFE_SCRIPT.test(script)) throw new Error("Package script is not on the safe workspace command policy");
    rejectCommandPathTraversal(script.trim().split(/\s+/).slice(1));
    return { executable, args: [args[0]] };
  }
  if (executable === "git" && SAFE_GIT.test(args.join(" "))) return { executable, args };
  if ((executable === "node" || executable === "python" || executable === "python3") && args.length === 1 && /^[A-Za-z0-9_./-]+\.(mjs|js|py)$/.test(args[0])) {
    await assertWorkspaceScriptPath(cwd, args[0]);
    return { executable, args };
  }
  throw new Error("Command is not on the allowed workspace command list");
}

export async function runWorkspaceCommand(projectId: number, command: string, timeout = 20_000, signal?: AbortSignal) {
  const cwd = await ensureWorkspace(projectId); const started = Date.now();
  try {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Project commands are disabled in production until an operating-system-isolated execution runtime is configured. No project code was executed.");
    }
    const safe = await validateCommand(cwd, command); const result = await execFileAsync(safe.executable, safe.args, { cwd, timeout, signal, killSignal: "SIGTERM", maxBuffer: 240_000, env: { PATH: process.env.PATH, HOME: cwd, XDG_CONFIG_HOME: path.join(cwd, ".config"), npm_config_cache: path.join(cwd, ".npm-cache"), NODE_ENV: "test" } }); return { status: "passed" as const, exitCode: 0, output: `${result.stdout}${result.stderr}`.trim().slice(-20_000), durationMs: Date.now() - started }; }
  catch (error) { const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string }; return { status: "failed" as const, exitCode: typeof failure.code === "number" ? failure.code : 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}${failure.message ?? ""}`.trim().slice(-20_000), durationMs: Date.now() - started }; }
}
export async function installWorkspaceDependencies(projectId: number, signal?: AbortSignal) { return runWorkspaceCommand(projectId, "pnpm install --lockfile=false", 120_000, signal); }

export async function snapshotWorkspace(projectId: number, snapshotId: string) { const workspace = await ensureWorkspace(projectId); const snapshotRoot = path.join(ROOT, "snapshots", `project-${projectId}`, snapshotId); await fs.mkdir(snapshotRoot, { recursive: true }); const files = (await listWorkspaceFiles(projectId)).filter(file => file.kind === "file"); for (const file of files) { const source = path.join(workspace, file.path); const target = path.join(snapshotRoot, file.path); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); } return { snapshotPath: path.relative(ROOT, snapshotRoot), fileCount: files.length }; }

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { projectFiles, projectSnapshots } from "../../drizzle/schema";
import { clearProjectContext } from "../context/context-engine";
import { getDb } from "../db";
import { ensureWorkspace, MAX_SNAPSHOT_BYTES, MAX_SNAPSHOT_FILES, snapshotWorkspace } from "../tools/workspace-tools";
import { compareSnapshotFileHashes } from "./snapshot-diff";
import { assertSnapshotTreeHasNoSymlinks, resolveSnapshotDirectory } from "./snapshot-paths";

const ROOT = path.resolve(
  process.env.VOH_WORKSPACE_ROOT ?? path.join(process.cwd(), "workspace-data")
);

export async function createProjectSnapshot(input: {
  projectId: number;
  taskId?: number;
  reason: string;
}) {
  const snapshotId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = await snapshotWorkspace(input.projectId, snapshotId);
  const db = await getDb();
  if (db) {
    await db.insert(projectSnapshots).values({
      projectId: input.projectId,
      taskId: input.taskId,
      reason: input.reason,
      snapshotPath: snapshot.snapshotPath,
      fileCount: snapshot.fileCount,
    });
  }
  return { ...snapshot, snapshotId };
}

export async function listProjectSnapshots(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectSnapshots)
    .where(eq(projectSnapshots.projectId, projectId))
    .orderBy(desc(projectSnapshots.createdAt));
}

export async function restoreProjectSnapshot(
  projectId: number,
  snapshotId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (
    await db
      .select()
      .from(projectSnapshots)
      .where(
        and(
          eq(projectSnapshots.id, snapshotId),
          eq(projectSnapshots.projectId, projectId)
        )
      )
      .limit(1)
  )[0];
  if (!row) throw new Error("Snapshot not found");
  const source = await resolveSnapshotDirectory(ROOT, row.snapshotPath);
  await assertSnapshotTreeHasNoSymlinks(source);

  const workspace = await ensureWorkspace(projectId);
  await fs.rm(workspace, { recursive: true, force: true });
  await fs.mkdir(workspace, { recursive: true });
  const restoredWorkspace = await ensureWorkspace(projectId);
  await fs.cp(source, restoredWorkspace, {
    recursive: true,
    force: true,
    dereference: false,
  });

  const relativePaths = await listRelativeFiles(restoredWorkspace);
  const indexedFiles: Array<typeof projectFiles.$inferInsert> = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(restoredWorkspace, relativePath);
    const fileStat = await fs.stat(absolutePath);
    if (fileStat.size > 60_000) continue;
    const content = await fs.readFile(absolutePath, "utf8");
    if (content.includes("\0")) continue;
    indexedFiles.push({
      projectId,
      path: relativePath,
      language: path.extname(relativePath).slice(1) || undefined,
      contentHash: crypto.createHash("sha256").update(content).digest("hex"),
      size: Buffer.byteLength(content, "utf8"),
      content,
      lastOperation: "restore",
    });
  }
  await db.transaction(async transaction => {
    await transaction
      .delete(projectFiles)
      .where(eq(projectFiles.projectId, projectId));
    if (indexedFiles.length)
      await transaction.insert(projectFiles).values(indexedFiles);
  });
  clearProjectContext(projectId);
  return {
    success: true,
    snapshotId: row.id,
    restoredFiles: relativePaths.length,
  };
}

export async function compareProjectSnapshot(
  projectId: number,
  snapshotId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = (
    await db
      .select()
      .from(projectSnapshots)
      .where(
        and(
          eq(projectSnapshots.id, snapshotId),
          eq(projectSnapshots.projectId, projectId)
        )
      )
      .limit(1)
  )[0];
  if (!row) throw new Error("Snapshot not found");
  const source = await resolveSnapshotDirectory(ROOT, row.snapshotPath);
  await assertSnapshotTreeHasNoSymlinks(source);
  const workspace = await ensureWorkspace(projectId);
  const [snapshotHashes, currentHashes] = await Promise.all([
    hashWorkspaceFiles(source),
    hashWorkspaceFiles(workspace),
  ]);
  return { snapshotId: row.id, ...compareSnapshotFileHashes(snapshotHashes, currentHashes) };
}


async function hashWorkspaceFiles(root: string) {
  const relativePaths = await listRelativeFiles(root);
  if (relativePaths.length > MAX_SNAPSHOT_FILES) throw new Error("Snapshot comparison exceeds the file-count limit");
  const hashes = new Map<string, string>();
  let totalBytes = 0;
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(root, relativePath);
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;
    const handle = await fs.open(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    try {
      const openedStat = await handle.stat();
      if (!openedStat.isFile()) continue;
      totalBytes += openedStat.size;
      if (totalBytes > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot comparison exceeds the storage limit");
      const hash = crypto.createHash("sha256");
      await new Promise<void>((resolve, reject) => {
        const stream = handle.createReadStream({ autoClose: false });
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", resolve);
      });
      hashes.set(relativePath, hash.digest("hex"));
    } finally {
      await handle.close();
    }
  }
  return hashes;
}

async function listRelativeFiles(root: string) {
  const output: string[] = [];
  const walk = async (current: string) => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === "node_modules") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) output.push(path.relative(root, absolute));
    }
  };
  await walk(root);
  return output.sort();
}

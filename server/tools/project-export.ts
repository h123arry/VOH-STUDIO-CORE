import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { ensureWorkspace, listWorkspaceFiles, normalizeWorkspacePath } from "./workspace-tools";
import { containsSensitiveValue, isSensitiveProjectPath } from "../security/project-content";

const MAX_ARCHIVE_FILES = 500;
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export async function readRegularWorkspaceFile(root: string, relativePath: string): Promise<Buffer | null> {
  const safe = normalizeWorkspacePath(relativePath);
  const absolute = path.resolve(root, safe);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error("Project export path escaped its workspace");
  }

  const segments = safe.split(path.sep);
  let current = root;
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index]);
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink()) throw new Error("Symbolic links are not included in project exports");
    if (index < segments.length - 1 && !entry.isDirectory()) {
      throw new Error("Project export parent path is not a directory");
    }
    if (index === segments.length - 1 && !entry.isFile()) {
      throw new Error("Only regular files can be included in project exports");
    }
  }

  const handle = await fs.open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error("Only regular files can be included in project exports");
    if (opened.size > MAX_FILE_BYTES) return null;
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export function isSafeProjectExportFile(filePath: string, content: Buffer) {
  return !isSensitiveProjectPath(filePath) && !containsSensitiveValue(content.toString("utf8"));
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries: Array<{ path: string; content: Buffer }>) {
  if (entries.length > MAX_ARCHIVE_FILES) throw new Error("Project contains too many files to export in one archive");
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    const safePath = normalizeWorkspacePath(entry.path);
    const name = Buffer.from(safePath.split(path.sep).join("/"), "utf8");
    if (!name.length || name.length > 0xffff) throw new Error("Archive contains an invalid file path");
    totalBytes += entry.content.length;
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error("Project export exceeds the 25 MB archive limit");
    const compressed = deflateRawSync(entry.content);
    const checksum = crc32(entry.content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localData, centralDirectory, end]);
}

export async function createWorkspaceZip(projectId: number) {
  const root = await ensureWorkspace(projectId);
  const diskFiles = (await listWorkspaceFiles(projectId)).filter(file => file.kind === "file");
  if (diskFiles.length > MAX_ARCHIVE_FILES) throw new Error("Project contains too many files to export in one archive");

  const entries: Array<{ path: string; content: Buffer }> = [];
  let skippedFiles = 0;
  let totalBytes = 0;

  for (const file of diskFiles) {
    const safe = normalizeWorkspacePath(file.path);
    let content: Buffer;
    try {
      const read = await readRegularWorkspaceFile(root, safe);
      if (!read) {
        skippedFiles++;
        continue;
      }
      content = read;
    } catch (error) {
      if (error instanceof Error && /Symbolic links|regular files|parent path/.test(error.message)) {
        skippedFiles++;
        continue;
      }
      throw error;
    }
    const portablePath = safe.split(path.sep).join("/");
    if (!isSafeProjectExportFile(portablePath, content)) {
      skippedFiles++;
      continue;
    }
    totalBytes += content.length;
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error("Project export exceeds the 25 MB archive limit");
    entries.push({ path: portablePath, content });
  }

  return {
    archive: buildZipArchive(entries),
    fileCount: entries.length,
    skippedFiles,
    uncompressedBytes: totalBytes,
  };
}

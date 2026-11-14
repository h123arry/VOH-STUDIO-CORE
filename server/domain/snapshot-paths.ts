import fs from "node:fs/promises";
import path from "node:path";

export async function resolveSnapshotDirectory(root: string, relativePath: string) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes(String.fromCharCode(0))) {
    throw new Error("Snapshot path is outside storage");
  }
  const absoluteRoot = path.resolve(root);
  const candidate = path.resolve(absoluteRoot, relativePath);
  if (candidate === absoluteRoot || !candidate.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error("Snapshot path is outside storage");
  }

  const rootStat = await fs.lstat(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Snapshot storage root must be a real directory");
  }

  const segments = path.relative(absoluteRoot, candidate).split(path.sep).filter(Boolean);
  let current = absoluteRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink()) throw new Error("Snapshot paths cannot traverse symbolic links");
    if (index < segments.length - 1 && !entry.isDirectory()) {
      throw new Error("Snapshot path contains a non-directory component");
    }
  }

  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(absoluteRoot),
    fs.realpath(candidate),
  ]);
  if (realCandidate === realRoot || !realCandidate.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error("Snapshot path resolves outside storage");
  }
  const candidateStat = await fs.stat(realCandidate);
  if (!candidateStat.isDirectory()) throw new Error("Snapshot is not a workspace directory");
  return realCandidate;
}

export async function assertSnapshotTreeHasNoSymlinks(root: string) {
  const rootStat = await fs.lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Snapshot must be a real directory");
  }
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error("Snapshot contents cannot contain symbolic links");
      if (stat.isDirectory()) await walk(absolute);
      else if (!stat.isFile()) throw new Error("Snapshot contains an unsupported filesystem entry");
    }
  };
  await walk(root);
}


export async function createSnapshotDirectory(root: string, relativePath: string) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes(String.fromCharCode(0)) || path.isAbsolute(relativePath)) {
    throw new Error("Snapshot destination is outside storage");
  }
  const segments = relativePath.split(/[\\/]/);
  if (segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Snapshot destination is outside storage");
  }
  const absoluteRoot = path.resolve(root);
  await fs.mkdir(absoluteRoot, { recursive: true });
  const rootStat = await fs.lstat(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Snapshot storage root must be a real directory");
  }
  const realRoot = await fs.realpath(absoluteRoot);
  let current = absoluteRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let created = true;
    try {
      await fs.mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      created = false;
    }
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error("Snapshot destination cannot traverse symbolic links or non-directories");
    }
    if (index === segments.length - 1 && !created) {
      throw new Error("Snapshot destination already exists");
    }
  }
  const realDestination = await fs.realpath(current);
  if (!realDestination.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error("Snapshot destination resolves outside storage");
  }
  return realDestination;
}

export async function ensureSnapshotSubdirectory(root: string, relativePath: string) {
  if (relativePath === "." || relativePath === "") return root;
  if (path.isAbsolute(relativePath) || relativePath.includes(String.fromCharCode(0))) {
    throw new Error("Snapshot directory path is outside storage");
  }
  const segments = relativePath.split(/[\\/]/);
  if (segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Snapshot directory path is outside storage");
  }
  const absoluteRoot = path.resolve(root);
  const rootStat = await fs.lstat(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Snapshot root must be a real directory");
  }
  const realRoot = await fs.realpath(absoluteRoot);
  let current = absoluteRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      await fs.mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const entry = await fs.lstat(current);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error("Snapshot directories cannot traverse symbolic links");
    }
    const realCurrent = await fs.realpath(current);
    if (realCurrent !== realRoot && !realCurrent.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error("Snapshot directory resolves outside storage");
    }
  }
  return current;
}

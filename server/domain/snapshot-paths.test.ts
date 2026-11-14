import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertSnapshotTreeHasNoSymlinks, createSnapshotDirectory, ensureSnapshotSubdirectory, resolveSnapshotDirectory } from "./snapshot-paths";

const roots: string[] = [];
async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-snapshot-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("snapshot path validation", () => {
  it("resolves a real snapshot directory inside storage", async () => {
    const root = await makeRoot();
    const snapshot = path.join(root, "snapshots", "project-1", "snapshot-a");
    await fs.mkdir(snapshot, { recursive: true });
    await fs.writeFile(path.join(snapshot, "index.html"), "<main>safe</main>");
    await expect(resolveSnapshotDirectory(root, path.join("snapshots", "project-1", "snapshot-a"))).resolves.toBe(await fs.realpath(snapshot));
  });

  it("rejects traversal outside snapshot storage", async () => {
    const root = await makeRoot();
    await expect(resolveSnapshotDirectory(root, "../outside")).rejects.toThrow("outside storage");
  });

  it("rejects a snapshot reached through a symlink", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await fs.mkdir(path.join(outside, "snapshot"), { recursive: true });
    await fs.symlink(outside, path.join(root, "linked"), "dir");
    await expect(resolveSnapshotDirectory(root, path.join("linked", "snapshot"))).rejects.toThrow("symbolic link");
  });

  it("rejects symlinks embedded in an otherwise valid snapshot tree", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    const snapshot = path.join(root, "snapshot");
    await fs.mkdir(snapshot, { recursive: true });
    await fs.writeFile(path.join(outside, "secret.txt"), "do not restore");
    await fs.symlink(path.join(outside, "secret.txt"), path.join(snapshot, "linked.txt"));
    await expect(assertSnapshotTreeHasNoSymlinks(snapshot)).rejects.toThrow("symbolic links");
  });

  it("accepts ordinary files and directories in a snapshot tree", async () => {
    const root = await makeRoot();
    const snapshot = path.join(root, "snapshot");
    await fs.mkdir(path.join(snapshot, "src"), { recursive: true });
    await fs.writeFile(path.join(snapshot, "src", "main.js"), "export const ok = true;");
    await expect(assertSnapshotTreeHasNoSymlinks(snapshot)).resolves.toBeUndefined();
  });
});


describe("snapshot destination creation", () => {
  it("creates a unique snapshot directory and refuses to reuse it", async () => {
    const root = await makeRoot();
    const destination = await createSnapshotDirectory(root, path.join("snapshots", "project-7", "snapshot-1"));
    expect(destination).toBe(await fs.realpath(destination));
    await expect(createSnapshotDirectory(root, path.join("snapshots", "project-7", "snapshot-1"))).rejects.toThrow("already exists");
  });

  it("rejects a symlink in the snapshot destination path", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await fs.symlink(outside, path.join(root, "snapshots"), "dir");
    await expect(createSnapshotDirectory(root, path.join("snapshots", "project-7", "snapshot-2"))).rejects.toThrow("symbolic links");
  });

  it("creates nested snapshot parents without following symlinks", async () => {
    const root = await makeRoot();
    const snapshot = await createSnapshotDirectory(root, path.join("snapshots", "project-9", "snapshot-3"));
    await expect(ensureSnapshotSubdirectory(snapshot, path.join("src", "components"))).resolves.toBe(path.join(snapshot, "src", "components"));
    await fs.symlink(await makeRoot(), path.join(snapshot, "linked"), "dir");
    await expect(ensureSnapshotSubdirectory(snapshot, path.join("linked", "escape"))).rejects.toThrow("symbolic links");
  });
});

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteSnapshotDirectoryAtomically } from "./snapshot-delete";

const roots: string[] = [];
async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-snapshot-delete-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("atomic snapshot deletion", () => {
  it("removes the snapshot after persistence succeeds", async () => {
    const root = await makeRoot();
    const source = path.join(root, "snapshot");
    const tombstone = path.join(root, "snapshot.delete");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "index.html"), "saved");

    await deleteSnapshotDirectoryAtomically(source, tombstone, async () => undefined);

    await expect(fs.access(source)).rejects.toThrow();
    await expect(fs.access(tombstone)).rejects.toThrow();
  });

  it("restores the snapshot directory if database deletion fails", async () => {
    const root = await makeRoot();
    const source = path.join(root, "snapshot");
    const tombstone = path.join(root, "snapshot.delete");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "index.html"), "saved");

    await expect(
      deleteSnapshotDirectoryAtomically(source, tombstone, async () => {
        throw new Error("database delete failed");
      })
    ).rejects.toThrow("database delete failed");

    await expect(fs.readFile(path.join(source, "index.html"), "utf8")).resolves.toBe("saved");
    await expect(fs.access(tombstone)).rejects.toThrow();
  });
});

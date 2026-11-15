import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreWorkspaceDirectoryAtomically } from "./snapshot-restore";

const roots: string[] = [];
async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-restore-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("atomic workspace snapshot restore", () => {
  it("swaps the staged workspace and removes the backup after persistence succeeds", async () => {
    const root = await makeRoot();
    const workspace = path.join(root, "workspace");
    const staging = path.join(root, "staging");
    const backup = path.join(root, "backup");
    await fs.mkdir(workspace);
    await fs.mkdir(staging);
    await fs.writeFile(path.join(workspace, "old.txt"), "old");
    await fs.writeFile(path.join(staging, "new.txt"), "new");
    const persist = vi.fn().mockResolvedValue(undefined);

    await restoreWorkspaceDirectoryAtomically(workspace, staging, backup, persist);

    await expect(fs.readFile(path.join(workspace, "new.txt"), "utf8")).resolves.toBe("new");
    await expect(fs.access(path.join(workspace, "old.txt"))).rejects.toThrow();
    await expect(fs.access(backup)).rejects.toThrow();
    expect(persist).toHaveBeenCalledOnce();
  });

  it("restores the previous workspace if persistence fails", async () => {
    const root = await makeRoot();
    const workspace = path.join(root, "workspace");
    const staging = path.join(root, "staging");
    const backup = path.join(root, "backup");
    await fs.mkdir(workspace);
    await fs.mkdir(staging);
    await fs.writeFile(path.join(workspace, "old.txt"), "old");
    await fs.writeFile(path.join(staging, "new.txt"), "new");

    await expect(
      restoreWorkspaceDirectoryAtomically(workspace, staging, backup, async () => {
        throw new Error("database transaction failed");
      })
    ).rejects.toThrow("database transaction failed");

    await expect(fs.readFile(path.join(workspace, "old.txt"), "utf8")).resolves.toBe("old");
    await expect(fs.access(path.join(workspace, "new.txt"))).rejects.toThrow();
    await expect(fs.access(backup)).rejects.toThrow();
  });

  it("restores the previous workspace if the staging directory cannot be installed", async () => {
    const root = await makeRoot();
    const workspace = path.join(root, "workspace");
    const staging = path.join(root, "missing-staging");
    const backup = path.join(root, "backup");
    await fs.mkdir(workspace);
    await fs.writeFile(path.join(workspace, "old.txt"), "old");

    await expect(
      restoreWorkspaceDirectoryAtomically(workspace, staging, backup, async () => undefined)
    ).rejects.toThrow();

    await expect(fs.readFile(path.join(workspace, "old.txt"), "utf8")).resolves.toBe("old");
    await expect(fs.access(backup)).rejects.toThrow();
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createWorkspaceFile, deleteWorkspaceFile, ensureWorkspace, assertSnapshotInventoryWithinLimits, MAX_SNAPSHOT_BYTES, MAX_SNAPSHOT_FILES, normalizeWorkspacePath, projectWorkspace, readWorkspaceAsset, readWorkspaceFile, readWorkspaceFileBuffer, renameWorkspaceFile, runWorkspaceCommand, writeWorkspaceFile } from "./tools/workspace-tools";

describe("workspace path validation", () => {
  it("normalizes safe nested paths across separator styles", () => {
    expect(normalizeWorkspacePath("src/components/App.tsx")).toBe(["src", "components", "App.tsx"].join(path.sep));
    expect(normalizeWorkspacePath(String.raw`src\components\App.tsx`)).toBe(["src", "components", "App.tsx"].join(path.sep));
  });

  it.each([
    "../outside.txt",
    "src/../../outside.txt",
    String.raw`..\outside.txt`,
    String.raw`C:\Windows\system.ini`,
    "/etc/passwd",
    String.raw`\\server\share\file.txt`,
    "",
    ".",
  ])("rejects unsafe path %s", value => {
    expect(() => normalizeWorkspacePath(value)).toThrow("Path is outside the project workspace");
  });

  it("rejects null bytes", () => {
    expect(() => normalizeWorkspacePath("src" + String.fromCharCode(0) + "secret.txt")).toThrow("Path is outside the project workspace");
  });
});


describe("safe workspace file reads", () => {
  it("reads regular source files and preview assets", async () => {
    const projectId = 7_950_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "src"), { recursive: true });
      await fs.writeFile(path.join(root, "src", "app.ts"), "export const ok = true;");
      await fs.writeFile(path.join(root, "src", "image.bin"), Buffer.from([1, 2, 3]));
      await expect(readWorkspaceFile(projectId, "src/app.ts")).resolves.toBe("export const ok = true;");
      await expect(readWorkspaceAsset(projectId, "src/image.bin")).resolves.toMatchObject({
        path: path.join("src", "image.bin"),
        content: Buffer.from([1, 2, 3]),
        size: 3,
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinked parent directories even when they point inside the workspace", async () => {
    const projectId = 7_960_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "real"), { recursive: true });
      await fs.writeFile(path.join(root, "real", "secret.txt"), "not directly addressable");
      await fs.symlink(path.join(root, "real"), path.join(root, "linked"), "dir");
      await expect(readWorkspaceFile(projectId, "linked/secret.txt")).rejects.toThrow("Symbolic links are not readable");
      await expect(readWorkspaceAsset(projectId, "linked/secret.txt")).rejects.toThrow("Symbolic links are not readable");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe("snapshot-safe workspace reads", () => {
  it("reads snapshot sources through the verified file handle", async () => {
    const projectId = 8_960_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "src"), { recursive: true });
      await fs.writeFile(path.join(root, "src", "large-source.ts"), Buffer.alloc(80_000, 65));
      const result = await readWorkspaceFileBuffer(projectId, "src/large-source.ts", 100_000);
      expect(result.size).toBe(80_000);
      expect(result.content.length).toBe(80_000);
      await expect(readWorkspaceFileBuffer(projectId, "src/large-source.ts", 70_000)).rejects.toThrow("read size limit");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects snapshot reads through symlinked parent directories", async () => {
    const projectId = 8_970_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "real"), { recursive: true });
      await fs.writeFile(path.join(root, "real", "secret.txt"), "private");
      await fs.symlink(path.join(root, "real"), path.join(root, "linked"), "dir");
      await expect(readWorkspaceFileBuffer(projectId, "linked/secret.txt")).rejects.toThrow("Symbolic links are not readable");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe("atomic workspace file writes", () => {
  it("creates nested files and replaces existing content completely", async () => {
    const projectId = 8_000_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      const first = await writeWorkspaceFile(projectId, "src/nested/app.ts", "export const version = 1;");
      expect(first.size).toBe(Buffer.byteLength("export const version = 1;"));
      await writeWorkspaceFile(projectId, "src/nested/app.ts", "export const version = 2;");
      await expect(fs.readFile(path.join(root, "src", "nested", "app.ts"), "utf8")).resolves.toBe("export const version = 2;");
      const entries = await fs.readdir(path.join(root, "src", "nested"));
      expect(entries).toEqual(["app.ts"]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects writes through symlinked parent directories", async () => {
    const projectId = 8_100_000 + process.pid;
    const root = projectWorkspace(projectId);
    const outside = path.join(path.dirname(root), `voh-outside-${projectId}`);
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
    try {
      await fs.mkdir(root, { recursive: true });
      await fs.mkdir(outside, { recursive: true });
      await fs.symlink(outside, path.join(root, "linked"), "dir");
      await expect(writeWorkspaceFile(projectId, "linked/escape.txt", "nope")).rejects.toThrow("Symbolic links are not allowed");
      await expect(fs.access(path.join(outside, "escape.txt"))).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});


describe("workspace file creation", () => {
  it("creates a new file without replacing an existing file", async () => {
    const projectId = 8_200_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await expect(createWorkspaceFile(projectId, "src/new.ts", "export const created = true;")).resolves.toMatchObject({ path: path.join("src", "new.ts") });
      await expect(createWorkspaceFile(projectId, "src/new.ts", "replacement")).rejects.toThrow("A file already exists");
      await expect(fs.readFile(path.join(root, "src", "new.ts"), "utf8")).resolves.toBe("export const created = true;");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});


describe("workspace file deletion", () => {
  it("deletes a regular file and removes its indexed record", async () => {
    const projectId = 8_300_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await writeWorkspaceFile(projectId, "src/remove-me.ts", "export const temporary = true;");
      await expect(deleteWorkspaceFile(projectId, "src/remove-me.ts")).resolves.toMatchObject({ path: path.join("src", "remove-me.ts"), deleted: true });
      await expect(fs.access(path.join(root, "src", "remove-me.ts"))).rejects.toThrow();
      await expect(deleteWorkspaceFile(projectId, "src/remove-me.ts")).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to delete directories and symlinks", async () => {
    const projectId = 8_400_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "folder"), { recursive: true });
      await fs.writeFile(path.join(root, "target.txt"), "keep");
      await fs.symlink(path.join(root, "target.txt"), path.join(root, "linked.txt"));
      await expect(deleteWorkspaceFile(projectId, "folder")).rejects.toThrow("Only regular files");
      await expect(deleteWorkspaceFile(projectId, "linked.txt")).rejects.toThrow("Symbolic links");
      await expect(fs.readFile(path.join(root, "target.txt"), "utf8")).resolves.toBe("keep");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});


describe("workspace file rename", () => {
  it("renames regular files without overwriting an existing destination", async () => {
    const projectId = 8_500_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await writeWorkspaceFile(projectId, "src/old-name.ts", "export const original = true;");
      await writeWorkspaceFile(projectId, "src/taken.ts", "keep this file");
      await expect(renameWorkspaceFile(projectId, "src/old-name.ts", "src/new-name.ts")).resolves.toMatchObject({ path: path.join("src", "new-name.ts"), renamed: true });
      await expect(fs.readFile(path.join(root, "src", "new-name.ts"), "utf8")).resolves.toBe("export const original = true;");
      await expect(fs.access(path.join(root, "src", "old-name.ts"))).rejects.toThrow();
      await expect(renameWorkspaceFile(projectId, "src/new-name.ts", "src/taken.ts")).rejects.toThrow();
      await expect(fs.readFile(path.join(root, "src", "taken.ts"), "utf8")).resolves.toBe("keep this file");
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it("refuses to rename symlinks and directories", async () => {
    const projectId = 8_600_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "folder"), { recursive: true });
      await fs.writeFile(path.join(root, "target.txt"), "keep");
      await fs.symlink(path.join(root, "target.txt"), path.join(root, "linked.txt"));
      await expect(renameWorkspaceFile(projectId, "folder", "folder-new")).rejects.toThrow("Only regular files");
      await expect(renameWorkspaceFile(projectId, "linked.txt", "renamed.txt")).rejects.toThrow("Symbolic links");
      await expect(fs.readFile(path.join(root, "target.txt"), "utf8")).resolves.toBe("keep");
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});


describe("workspace command path boundaries", () => {
  it("rejects scripts that escape the project directory", async () => {
    const projectId = 8_700_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(root, { recursive: true });
      const outside = path.join(path.dirname(root), `voh-outside-script-${projectId}.js`);
      await fs.writeFile(outside, "process.exit(0)");
      try {
        const result = await runWorkspaceCommand(projectId, "node ../" + path.basename(outside));
        expect(result.status).toBe("failed");
        expect(result.output).toContain("outside the project directory");
      } finally {
        await fs.rm(outside, { force: true });
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects package scripts containing parent-directory traversal", async () => {
    const projectId = 8_800_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node ../outside.js" } }));
      const result = await runWorkspaceCommand(projectId, "pnpm test");
      expect(result.status).toBe("failed");
      expect(result.output).toContain("outside the project directory");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});


describe("production workspace execution boundary", () => {
  it("does not execute project commands on the application server in production", async () => {
    const projectId = 8_900_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    vi.stubEnv("NODE_ENV", "production");
    try {
      const result = await runWorkspaceCommand(projectId, "git status");
      expect(result.status).toBe("failed");
      expect(result.output).toContain("disabled in production");
      expect(result.output).toContain("No project code was executed");
    } finally {
      vi.unstubAllEnvs();
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});


describe("project workspace root validation", () => {
  it("rejects a project directory that is replaced with a symlink", async () => {
    const projectId = 8_950_000 + process.pid;
    const root = projectWorkspace(projectId);
    const outside = path.join(path.dirname(root), `voh-outside-root-${projectId}`);
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, "private.txt"), "outside workspace");
    try {
      await fs.symlink(outside, root, "dir");
      await expect(ensureWorkspace(projectId)).rejects.toThrow("symbolic link");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects invalid project identifiers", async () => {
    await expect(ensureWorkspace(0)).rejects.toThrow("Invalid project workspace identifier");
    await expect(ensureWorkspace(-1)).rejects.toThrow("Invalid project workspace identifier");
    await expect(ensureWorkspace(Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow("Invalid project workspace identifier");
  });
});


describe("snapshot storage limits", () => {
  it("rejects snapshots containing too many files", () => {
    const files = Array.from({ length: MAX_SNAPSHOT_FILES + 1 }, () => ({ kind: "file" as const, size: 1 }));
    expect(() => assertSnapshotInventoryWithinLimits(files)).toThrow("file limit");
  });

  it("rejects snapshots that exceed the total byte budget", () => {
    expect(() => assertSnapshotInventoryWithinLimits([{ kind: "file", size: MAX_SNAPSHOT_BYTES + 1 }])).toThrow("storage limit");
  });

  it("counts only regular files and accepts inventories within the budget", () => {
    expect(assertSnapshotInventoryWithinLimits([
      { kind: "directory", size: 0 },
      { kind: "file", size: 120 },
      { kind: "file", size: 80 },
    ])).toEqual({ fileCount: 2, totalBytes: 200 });
  });
});

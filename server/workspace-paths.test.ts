import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWorkspacePath, projectWorkspace, writeWorkspaceFile } from "./tools/workspace-tools";

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

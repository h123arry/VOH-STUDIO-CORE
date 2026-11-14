import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWorkspacePath } from "./tools/workspace-tools";

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

import { describe, expect, it } from "vitest";
import { normalizeWorkspacePath } from "./tools/workspace-tools";

describe("workspace path validation", () => {
  it("normalizes safe nested paths", () => {
    expect(normalizeWorkspacePath("src/components/App.tsx")).toBe("src/components/App.tsx");
    expect(normalizeWorkspacePath("src\\\\components\\\\App.tsx")).toBe("src/components/App.tsx".split("/").join(require("node:path").sep));
  });

  it.each([
    "../outside.txt",
    "src/../../outside.txt",
    "..\\\\outside.txt",
    "C:\\\\Windows\\\\system.ini",
    "/etc/passwd",
    "\\\\server\\\\share\\\\file.txt",
    "",
    ".",
  ])("rejects unsafe path %s", value => {
    expect(() => normalizeWorkspacePath(value)).toThrow("Path is outside the project workspace");
  });

  it("rejects null bytes", () => {
    expect(() => normalizeWorkspacePath("src\\0secret.txt")).toThrow("Path is outside the project workspace");
  });
});

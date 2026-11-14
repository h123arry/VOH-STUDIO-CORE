import { describe, expect, it } from "vitest";
import { repositoryFileIndexSafety, validateGitRemote } from "./lifecycle/git-service";

describe("public Git repository URL validation", () => {
  it.each([
    "https://github.com/h123arry/VOH-STUDIO-CORE",
    "https://github.com/h123arry/VOH-STUDIO-CORE.git",
    "https://gitlab.com/group/subgroup/project",
    "https://bitbucket.org/team/project",
  ])("accepts supported public repository URL %s", value => {
    expect(validateGitRemote(value)).toBe(value);
  });

  it.each([
    "http://github.com/owner/repo",
    "https://evil.example/owner/repo",
    "https://github.com.evil.example/owner/repo",
    "https://user:password@github.com/owner/repo",
    "https://github.com:8443/owner/repo",
    "https://github.com/owner/repo?token=secret",
    "https://github.com/owner",
    "git@github.com:owner/repo.git",
    "file:///etc/passwd",
  ])("rejects unsafe or unsupported repository URL %s", value => {
    expect(() => validateGitRemote(value)).toThrow();
  });
});

describe("repository import indexing safety", () => {
  it("excludes environment and private-key paths", () => {
    expect(repositoryFileIndexSafety(".env", "PUBLIC_URL=https://example.com").safe).toBe(false);
    expect(repositoryFileIndexSafety("certs/server.pem", "not a key").safe).toBe(false);
  });

  it("excludes files containing credential-like values", () => {
    expect(repositoryFileIndexSafety("src/config.ts", 'const password = "example-secret";').safe).toBe(false);
    expect(repositoryFileIndexSafety("src/config.ts", "const apiKey = 'github_pat_abcdefghijklmnop';").safe).toBe(false);
  });

  it("allows ordinary source files", () => {
    expect(repositoryFileIndexSafety("src/main.ts", "export const ready = true;")).toMatchObject({ safe: true, reason: null });
  });
});

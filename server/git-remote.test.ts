import { describe, expect, it } from "vitest";
import { validateGitRemote } from "./lifecycle/git-service";

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

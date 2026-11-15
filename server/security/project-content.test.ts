import { describe, expect, it } from "vitest";
import { containsSensitiveValue, isSafeProjectContextFile, isSensitiveProjectPath } from "./project-content";

describe("sensitive project content filtering", () => {
  it.each([
    [".env", "root environment file"],
    [".env.production", "production environment file"],
    ["config/prod.env", "environment file"],
    [".ssh/id_ed25519", "private SSH key"],
    ["secrets/service-account.json", "service account file"],
    ["config/firebase-adminsdk-test.json", "Firebase service account"],
    ["certs/app.p12", "certificate bundle"],
    [".npmrc", "package registry credentials"],
    [String.raw`C:\\Users\\demo\\.aws\\credentials`, "Windows credential path"],
  ])("recognizes sensitive path %s", filePath => {
    expect(isSensitiveProjectPath(filePath)).toBe(true);
  });

  it("recognizes private keys, API keys, bearer tokens, and provider tokens", () => {
    const sensitiveValues = [
      "-----BEGIN PRIVATE KEY-----\\nredacted\\n-----END PRIVATE KEY-----",
      "const apiKey = \"sk-proj-" + "x".repeat(30) + "\";",
      "Authorization: Bearer " + "x".repeat(40),
      "AKIA" + "A".repeat(16),
      "ghp_" + "x".repeat(36),
      "xoxb-" + "x".repeat(30),
    ];
    for (const value of sensitiveValues) {
      expect(containsSensitiveValue(value)).toBe(true);
      expect(isSafeProjectContextFile("src/config.ts", value)).toBe(false);
    }
  });

  it("keeps ordinary source and documentation available to project context", () => {
    expect(isSafeProjectContextFile("src/App.tsx", "export function App() { return null; }")).toBe(true);
    expect(isSafeProjectContextFile("README.md", "This project builds a web workspace.")).toBe(true);
  });
});

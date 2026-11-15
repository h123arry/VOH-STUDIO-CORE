import { describe, expect, it } from "vitest";
import { containsSensitiveValue, isSafeProjectContextFile, isSensitiveProjectPath } from "./project-content";

describe("sensitive project content filtering", () => {
  it.each([
    [".env", "root environment file"],
    [".env.production", "production environment file"],
    ["config/prod.env", "environment file"],
    [".ssh/id_ed25519", "private SSH key"],
    ["secrets/service-account.json", "service account file"],
    ["secrets.json", "secret values file"],
    ["config/credentials.yml", "credential file"],
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


describe("additional provider credential patterns", () => {
  it("recognizes service-role keys, database URLs, Stripe secrets, and JWTs", () => {
    const sensitiveValues = [
      "const SUPABASE_SERVICE_ROLE_KEY = \"" + "x".repeat(32) + "\";",
      "const DATABASE_URL = \"postgres://user:" + "p".repeat(24) + "@localhost/db\";",
      "const stripeSecret = \"sk_live_" + "x".repeat(24) + "\";",
      "const token = \"eyJ" + "a".repeat(20) + "." + "b".repeat(20) + "." + "c".repeat(20) + "\";",
    ];
    for (const value of sensitiveValues) expect(containsSensitiveValue(value)).toBe(true);
  });

  it("does not flag ordinary theme keys as credentials", () => {
    expect(containsSensitiveValue('const themeKey = "dark-mode";')).toBe(false);
  });
});


describe("additional secret storage and credential formats", () => {
  it.each([
    [".docker/config.json", "Docker registry config"],
    [".kube/config", "Kubernetes credentials"],
    [".terraform/terraform.tfstate", "Terraform state"],
    ["terraform.tfstate.backup", "Terraform state backup"],
    [".git-credentials", "Git credentials"],
    [".vault-token", "Vault token"],
    [".config/gh/hosts.yml", "GitHub CLI credentials"],
    [".envrc", "direnv environment file"],
  ])("recognizes sensitive storage path %s", filePath => {
    expect(isSensitiveProjectPath(filePath)).toBe(true);
  });

  it("recognizes credentials embedded in service URLs and basic auth headers", () => {
    const url = "https://deploy-user:" + "p".repeat(24) + "@registry.example";
    const basicAuth = "Authorization: Basic " + "Q".repeat(32);
    expect(containsSensitiveValue(url)).toBe(true);
    expect(containsSensitiveValue(basicAuth)).toBe(true);
  });
});

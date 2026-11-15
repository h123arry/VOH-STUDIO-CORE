import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildZipArchive, createWorkspaceZip, isSafeProjectExportFile, readRegularWorkspaceFile } from "./tools/project-export";
import { projectWorkspace } from "./tools/workspace-tools";

describe("project ZIP export", () => {
  it("creates a valid UTF-8 ZIP archive with readable source entries", () => {
    const archive = buildZipArchive([
      { path: "index.html", content: Buffer.from("<main>VOH</main>", "utf8") },
      { path: "src/main.js", content: Buffer.from("export const ready = true;", "utf8") },
    ]);
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    const nameLength = archive.readUInt16LE(26);
    const extraLength = archive.readUInt16LE(28);
    const compressedSize = archive.readUInt32LE(18);
    const start = 30 + nameLength + extraLength;
    const firstContent = inflateRawSync(archive.subarray(start, start + compressedSize)).toString("utf8");
    expect(archive.subarray(30, 30 + nameLength).toString("utf8")).toBe("index.html");
    expect(firstContent).toBe("<main>VOH</main>");
    expect(archive.includes(Buffer.from([0x50, 0x4b, 0x01, 0x02]))).toBe(true);
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
  });

  it("rejects traversal and absolute paths", () => {
    expect(() => buildZipArchive([{ path: "../secret.txt", content: Buffer.from("secret") }])).toThrow();
    expect(() => buildZipArchive([{ path: "/etc/passwd", content: Buffer.from("secret") }])).toThrow();
  });

  it("creates a valid empty archive", () => {
    const archive = buildZipArchive([]);
    expect(archive.readUInt32LE(0)).toBe(0x06054b50);
    expect(archive.readUInt16LE(10)).toBe(0);
  });
});

describe("project export secret filtering", () => {
  it("excludes environment files and private key paths", () => {
    expect(isSafeProjectExportFile(".env", Buffer.from("APP_ENV=production"))).toBe(false);
    expect(isSafeProjectExportFile("certs/private.pem", Buffer.from("not a key"))).toBe(false);
  });

  it("excludes likely credentials in source content", () => {
    expect(isSafeProjectExportFile("src/config.ts", Buffer.from('const password = "example-secret";'))).toBe(false);
    expect(isSafeProjectExportFile("src/config.ts", Buffer.from("-----BEGIN PRIVATE KEY-----"))).toBe(false);
  });

  it("excludes cloud credentials and sensitive config paths", () => {
    expect(isSafeProjectExportFile(".npmrc", Buffer.from("registry=https://registry.example"))).toBe(false);
    expect(isSafeProjectExportFile("config/credentials.yml", Buffer.from("placeholder"))).toBe(false);
    const serviceRoleKey = "const SUPABASE_SERVICE_ROLE_KEY = \"" + "x".repeat(32) + "\";";
    const databaseUrl = "const DATABASE_URL = \"postgres://user:" + "p".repeat(24) + "@localhost/db\";";
    expect(isSafeProjectExportFile("src/config.ts", Buffer.from(serviceRoleKey))).toBe(false);
    expect(isSafeProjectExportFile("src/config.ts", Buffer.from(databaseUrl))).toBe(false);
  });

  it("allows ordinary project source", () => {
    expect(isSafeProjectExportFile("src/main.js", Buffer.from("export const ready = true;"))).toBe(true);
  });
});

describe("safe workspace export reads", () => {
  it("reads regular files under the workspace", async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), ".voh-export-test-"));
    try {
      await fs.mkdir(path.join(root, "src"));
      await fs.writeFile(path.join(root, "src", "app.ts"), "export const ok = true;");
      await expect(readRegularWorkspaceFile(root, "src/app.ts")).resolves.toEqual(
        Buffer.from("export const ok = true;")
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinked parent directories and symlinked files", async () => {
    const root = await fs.mkdtemp(path.join(process.cwd(), ".voh-export-test-"));
    const outside = await fs.mkdtemp(path.join(process.cwd(), ".voh-export-outside-"));
    try {
      await fs.writeFile(path.join(outside, "secret.txt"), "do not export");
      await fs.symlink(outside, path.join(root, "linked-dir"), "dir");
      await fs.symlink(path.join(outside, "secret.txt"), path.join(root, "linked-file"));
      await expect(readRegularWorkspaceFile(root, "linked-dir/secret.txt")).rejects.toThrow(/Symbolic links/);
      await expect(readRegularWorkspaceFile(root, "linked-file")).rejects.toThrow(/Symbolic links/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe("workspace project export", () => {
  it("exports safe source and skips secrets and oversized files", async () => {
    const projectId = 9_000_000 + process.pid;
    const root = projectWorkspace(projectId);
    await fs.rm(root, { recursive: true, force: true });
    try {
      await fs.mkdir(path.join(root, "src"), { recursive: true });
      await fs.writeFile(path.join(root, "index.html"), "<main>VOH</main>");
      await fs.writeFile(path.join(root, "src", "main.js"), "export const ready = true;");
      await fs.writeFile(path.join(root, ".env"), "PRIVATE_TOKEN=do-not-export");
      await fs.writeFile(path.join(root, "large.bin"), Buffer.alloc(5 * 1024 * 1024 + 1));
      const result = await createWorkspaceZip(projectId);
      expect(result.fileCount).toBe(2);
      expect(result.skippedFiles).toBe(2);
      expect(result.archive.readUInt32LE(0)).toBe(0x04034b50);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

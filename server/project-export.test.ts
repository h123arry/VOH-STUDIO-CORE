import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildZipArchive, isSafeProjectExportFile } from "./tools/project-export";

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

  it("allows ordinary project source", () => {
    expect(isSafeProjectExportFile("src/main.js", Buffer.from("export const ready = true;"))).toBe(true);
  });
});

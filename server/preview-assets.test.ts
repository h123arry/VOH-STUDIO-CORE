import { describe, expect, it } from "vitest";
import { PREVIEW_SECURITY_HEADERS, previewContentType } from "./tools/preview-assets";

describe("workspace preview isolation", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["src/main.mjs", "text/javascript; charset=utf-8"],
    ["assets/app.css", "text/css; charset=utf-8"],
    ["assets/logo.svg", "image/svg+xml"],
    ["assets/image.webp", "image/webp"],
    ["assets/font.woff2", "font/woff2"],
    ["assets/app.wasm", "application/wasm"],
    ["unknown.bin", "application/octet-stream"],
  ])("returns a safe content type for %s", (path, expected) => {
    expect(previewContentType(path)).toBe(expected);
  });

  it("sandboxes previews and blocks network access", () => {
    expect(PREVIEW_SECURITY_HEADERS["Content-Security-Policy"]).toContain("sandbox allow-scripts allow-same-origin");
    expect(PREVIEW_SECURITY_HEADERS["Content-Security-Policy"]).toContain("connect-src 'none'");
    expect(PREVIEW_SECURITY_HEADERS["Content-Security-Policy"]).toContain("worker-src 'none'");
    expect(PREVIEW_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(PREVIEW_SECURITY_HEADERS["Referrer-Policy"]).toBe("no-referrer");
  });
});

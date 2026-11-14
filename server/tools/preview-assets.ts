import path from "node:path";

const PREVIEW_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function previewContentType(relativePath: string) {
  return PREVIEW_TYPES[path.extname(relativePath).toLowerCase()] ?? "application/octet-stream";
}

export const PREVIEW_SECURITY_HEADERS = {
  // A sandboxed opaque origin keeps imported/generated code away from the
  // authenticated Studio origin while still allowing local scripts to run.
  "Content-Security-Policy": "sandbox allow-scripts; default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; media-src 'self' https: data: blob:; connect-src https:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'",
  "Access-Control-Allow-Origin": "null",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

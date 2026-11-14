import path from "node:path";
import ts from "typescript";
import postcss from "postcss";
import { listWorkspaceFiles, readWorkspaceFile } from "../tools/workspace-tools";

export type StaticVerificationResult = {
  status: "passed" | "failed";
  output: string;
  sourceFiles: number;
  manifestFiles: number;
  durationMs: number;
};

const MAX_STATIC_FILES = 500;
const MAX_STATIC_BYTES = 5_000_000;
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);
const JSON_EXTENSIONS = new Set([".json", ".webmanifest"]);

export async function verifyWorkspaceStatically(projectId: number): Promise<StaticVerificationResult> {
  const started = Date.now();
  const inventory = (await listWorkspaceFiles(projectId)).filter(file => file.kind === "file");
  const errors: string[] = [];
  const candidates = inventory.filter(file => {
    const extension = path.extname(file.path).toLowerCase();
    return SOURCE_EXTENSIONS.has(extension) || JSON_EXTENSIONS.has(extension) || extension === ".css";
  });

  if (inventory.length > MAX_STATIC_FILES) {
    errors.push(`Workspace contains ${inventory.length} files; static validation is capped at ${MAX_STATIC_FILES} files.`);
  }
  const candidateBytes = candidates.reduce((sum, file) => sum + file.size, 0);
  if (candidateBytes > MAX_STATIC_BYTES) {
    errors.push(`Source and manifest files total ${candidateBytes} bytes; static validation is capped at ${MAX_STATIC_BYTES} bytes.`);
  }

  let sourceFiles = 0;
  let manifestFiles = 0;
  for (const file of candidates.slice(0, MAX_STATIC_FILES)) {
    if (file.size > 60_000) {
      errors.push(`${file.path}: exceeds the 60 KB static parser limit.`);
      continue;
    }
    let content: string;
    try {
      content = await readWorkspaceFile(projectId, file.path);
    } catch (error) {
      errors.push(`${file.path}: could not be read safely (${error instanceof Error ? error.message : "unknown error"}).`);
      continue;
    }

    const extension = path.extname(file.path).toLowerCase();
    if (JSON_EXTENSIONS.has(extension)) {
      manifestFiles += 1;
      try {
        JSON.parse(content);
      } catch (error) {
        errors.push(`${file.path}: invalid JSON (${error instanceof Error ? error.message : "parse error"}).`);
      }
      continue;
    }

    if (extension === ".css") {
      try {
        postcss.parse(content, { from: file.path });
      } catch (error) {
        errors.push(`${file.path}: invalid CSS (${error instanceof Error ? error.message : "parse error"}).`);
      }
      continue;
    }

    sourceFiles += 1;
    const transpiled = ts.transpileModule(content, {
      fileName: file.path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    for (const diagnostic of transpiled.diagnostics ?? []) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\\n");
      errors.push(`${file.path}: syntax error: ${message}`);
    }
  }

  const summary = errors.length
    ? `Static validation found ${errors.length} issue(s). ${errors.slice(0, 12).join(" ")}`
    : `Static validation passed for ${sourceFiles} source file(s), ${manifestFiles} JSON manifest(s), and ${candidates.filter(file => path.extname(file.path).toLowerCase() === ".css").length} stylesheet(s). No project code was executed.`;
  return {
    status: errors.length ? "failed" : "passed",
    output: summary.slice(0, 20_000),
    sourceFiles,
    manifestFiles,
    durationMs: Date.now() - started,
  };
}

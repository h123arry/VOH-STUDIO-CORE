import { beforeEach, describe, expect, it, vi } from "vitest";

const { listProjectFiles } = vi.hoisted(() => ({ listProjectFiles: vi.fn() }));
vi.mock("../domain/project-service", () => ({ listProjectFiles }));

import { clearProjectContext, indexProjectContext } from "./context-engine";

describe("project context ingestion", () => {
  beforeEach(() => {
    clearProjectContext(42);
    listProjectFiles.mockReset();
  });

  it("does not index sensitive paths or files containing credentials", async () => {
    listProjectFiles.mockResolvedValue([
      { path: ".env", content: "API_KEY=not-for-model-context", language: "text", size: 32 },
      { path: "secrets.json", content: "{ \"token\": \"hidden\" }", language: "json", size: 28 },
      { path: "src/config.ts", content: "const apiKey = \"sk-" + "x".repeat(30) + "\";", language: "typescript", size: 50 },
      { path: "src/App.tsx", content: "export function App() { return null; }", language: "typescript", size: 40 },
    ]);

    const index = await indexProjectContext(42, true);
    expect(index.files.map(file => file.path)).toEqual(["src/App.tsx"]);
    expect(index.symbols).toContain("App");
  });
});

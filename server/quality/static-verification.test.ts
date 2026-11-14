import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { projectWorkspace, writeWorkspaceFile } from "../tools/workspace-tools";
import { verifyWorkspaceStatically } from "./static-verification";

const projectIds: number[] = [];

afterEach(async () => {
  await Promise.all(projectIds.splice(0).map(projectId => fs.rm(projectWorkspace(projectId), { recursive: true, force: true })));
});

describe("non-executing workspace static verification", () => {
  it("parses source, JSON manifests, and CSS without executing project code", async () => {
    const projectId = 9_100_000 + process.pid;
    projectIds.push(projectId);
    await writeWorkspaceFile(projectId, "package.json", JSON.stringify({ name: "static-check", scripts: { build: "node scripts/build.js" } }));
    await writeWorkspaceFile(projectId, "src/main.ts", "export const ready: boolean = true;");
    await writeWorkspaceFile(projectId, "src/styles.css", "main { display: grid; }");

    const result = await verifyWorkspaceStatically(projectId);
    expect(result.status).toBe("passed");
    expect(result.sourceFiles).toBe(1);
    expect(result.manifestFiles).toBe(1);
    expect(result.output).toContain("No project code was executed");
  });

  it("reports malformed source and JSON as static validation failures", async () => {
    const projectId = 9_200_000 + process.pid;
    projectIds.push(projectId);
    await writeWorkspaceFile(projectId, "package.json", "{ invalid json");
    await writeWorkspaceFile(projectId, "src/broken.js", "export const = ;");

    const result = await verifyWorkspaceStatically(projectId);
    expect(result.status).toBe("failed");
    expect(result.output).toContain("invalid JSON");
    expect(result.output).toContain("syntax error");
  });
});

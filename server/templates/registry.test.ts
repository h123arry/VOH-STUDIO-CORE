import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { Project } from "../drizzle/schema";
import { getTemplate } from "./registry";

const execFileAsync = promisify(execFile);
const project = {
  id: 1,
  ownerId: 1,
  name: "Pocket Planner",
  description: "A personal planning app",
  projectType: "mobile",
  slug: "pocket-planner",
  workspacePath: "workspace-data/project-1",
  settings: null,
  lifecycle: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
} as Project;

describe("mobile starter template", () => {
  it("creates a manifest-backed installable browser app without claiming native packaging", () => {
    const template = getTemplate("mobile");
    expect(template?.name).toContain("Installable mobile web app");
    const files = template!.files(project, "A mobile planner");
    const manifestFile = files.find(file => file.path === "manifest.webmanifest");
    expect(manifestFile).toBeDefined();
    expect(JSON.parse(manifestFile!.content)).toMatchObject({ name: "Pocket Planner", display: "standalone", start_url: "./", scope: "./" });
    expect(files.find(file => file.path === "index.html")?.content).toContain('rel="manifest"');
    expect(files.some(file => file.path === "icons/app.svg")).toBe(true);
    expect(files.some(file => file.path === "service-worker.js")).toBe(false);
    expect(files.find(file => file.path === "scripts/build.mjs")?.content).toContain("dist/manifest.webmanifest");
    expect(files.find(file => file.path === "scripts/test.mjs")?.content).toContain("Mobile PWA smoke test passed");
  });

  it("runs the generated mobile smoke test and creates a complete production output", async () => {
    const template = getTemplate("mobile")!;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-mobile-template-"));
    try {
      for (const file of template.files(project, "A mobile planner")) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 10_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      for (const file of ["dist/index.html", "dist/manifest.webmanifest", "dist/icons/app.svg", "dist/src/main.js", "dist/src/styles.css"]) {
        await expect(fs.access(path.join(root, file))).resolves.toBeUndefined();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from "vitest";
import type { Project } from "../drizzle/schema";
import { getTemplate } from "./registry";

describe("mobile starter template", () => {
  it("creates a manifest-backed installable browser app without claiming native packaging", () => {
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
    const template = getTemplate("mobile");
    expect(template?.name).toContain("Installable mobile web app");
    const files = template!.files(project, "A mobile planner");
    const manifestFile = files.find(file => file.path === "manifest.webmanifest");
    expect(manifestFile).toBeDefined();
    expect(JSON.parse(manifestFile!.content)).toMatchObject({ name: "Pocket Planner", display: "standalone", start_url: "/" });
    expect(files.find(file => file.path === "index.html")?.content).toContain('rel="manifest"');
    expect(files.some(file => file.path === "icons/app.svg")).toBe(true);
    expect(files.some(file => file.path === "service-worker.js")).toBe(false);
  });
});

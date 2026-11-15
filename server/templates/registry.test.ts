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
  it("creates an Expo React Native source project with persistent local notes and honest binary status", async () => {
    const template = getTemplate("native_mobile")!;
    expect(template.name).toContain("React Native");
    const files = template.files(project, "A personal mobile planner");
    const paths = files.map(file => file.path);
    expect(paths).toEqual(expect.arrayContaining(["App.tsx", "app.json", "package.json", "tsconfig.json", "scripts/verify-source.mjs", "README.md"]));
    const app = files.find(file => file.path === "App.tsx")!.content;
    expect(app).toContain("AsyncStorage.setItem");
    expect(app).toContain("AsyncStorage.getItem");
    const readme = files.find(file => file.path === "README.md")!.content;
    expect(readme).toContain("does not create an installable APK");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-native-mobile-"));
    try {
      for (const file of files) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/verify-source.mjs"], { cwd: root, timeout: 10_000 });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("generates a secure server-backed AI chat app with provider secrets kept server-side", async () => {
    const template = getTemplate("ai_app")!;
    const files = template.files({ ...project, projectType: "ai_app", name: "VOH Assistant" }, "A private AI assistant");
    const byPath = new Map(files.map(file => [file.path, file.content]));
    expect(byPath.has(".env.example")).toBe(true);
    expect(byPath.get(".gitignore")).toContain(".env");
    expect(byPath.get("public/main.js")).not.toContain("AI_API_KEY");
    expect(byPath.get("src/server.mjs")).toContain("process.env.AI_API_KEY");
    expect(byPath.get("src/server.mjs")).toContain("validateMessages");
    expect(byPath.get("src/server.mjs")).toContain("rateLimited");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-ai-app-"));
    try {
      for (const file of files) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 10_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      await expect(fs.access(path.join(root, "dist/index.html"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(root, "src/server.mjs"))).resolves.toBeUndefined();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("runs the generated website smoke test and builds its browser assets", async () => {
    const template = getTemplate("website")!;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-website-template-"));
    try {
      for (const file of template.files({ ...project, projectType: "website", name: "Atlas" }, "A responsive website")) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 10_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      for (const file of ["dist/index.html", "dist/src/main.js", "dist/src/styles.css"]) {
        await expect(fs.access(path.join(root, file))).resolves.toBeUndefined();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("includes touch controls, pause and persistent best score in the game template", () => {
    const files = getTemplate("game")!.files({ ...project, projectType: "game", name: "Orbit" }, "Collect sparks");
    const html = files.find(file => file.path === "index.html")!.content;
    const main = files.find(file => file.path === "src/main.js")!.content;
    const logic = files.find(file => file.path === "src/game.js")!.content;
    expect(html).toContain('data-key="ArrowUp"');
    expect(html).toContain('id="pause"');
    expect(main).toContain("localStorage.setItem('voh-game-best'");
    expect(main).toContain("pointerdown");
    expect(logic).toContain("togglePause");
    expect(files.find(file => file.path === "scripts/test.mjs")!.content).toContain("paused.status");
  });

  it("builds a complete responsive multi-page business website", async () => {
    const template = getTemplate("website")!;
    const files = template.files({ ...project, projectType: "website", name: "Atlas & Co" }, "A thoughtful business website");
    const paths = files.map(file => file.path);
    expect(paths).toEqual(expect.arrayContaining(["index.html", "about.html", "services.html", "contact.html", "src/main.js", "src/styles.css"]));
    expect(files.find(file => file.path === "index.html")?.content).toContain('aria-label="Main navigation"');
    expect(files.find(file => file.path === "contact.html")?.content).toContain('type="email"');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-multipage-website-"));
    try {
      for (const file of files) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 10_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      for (const page of ["index.html", "about.html", "services.html", "contact.html"]) {
        await expect(fs.access(path.join(root, "dist", page))).resolves.toBeUndefined();
      }
      await expect(fs.access(path.join(root, "dist/src/main.js"))).resolves.toBeUndefined();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("runs the generated game logic tests and builds the browser game", async () => {
    const template = getTemplate("game")!;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-game-template-"));
    try {
      for (const file of template.files({ ...project, projectType: "game", name: "Orbit" }, "Collect the sparks")) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 10_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      for (const file of ["dist/index.html", "dist/src/main.js", "dist/src/game.js", "dist/src/styles.css"]) {
        await expect(fs.access(path.join(root, file))).resolves.toBeUndefined();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

});

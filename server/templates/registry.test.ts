import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { Project } from "../drizzle/schema";
import { getTemplate } from "./registry";

const execFileAsync = promisify(execFile);
async function getFreePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => server.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port");
  const port = address.port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}
async function waitForHttp(url: string, child: ReturnType<typeof spawn>) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("Generated application exited before becoming ready");
    try { return await fetch(url); } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  throw new Error("Generated application did not start in time");
}
async function stopProcess(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null) return;
  await new Promise<void>(resolve => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
}

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

  it("generates an authenticated SQLite web app with persistent owner-scoped CRUD", async () => {
    const template = getTemplate("web_app")!;
    expect(template.name).toContain("SQLite");
    const files = template.files({ ...project, projectType: "web_app", name: "Task Desk" }, "A private task dashboard");
    const byPath = new Map(files.map(file => [file.path, file.content]));
    expect(byPath.get("src/server.mjs")).toContain("HttpOnly");
    expect(byPath.get("src/server.mjs")).toContain("user_id = ?");
    expect(byPath.get("src/db.mjs")).toContain("CREATE TABLE IF NOT EXISTS tasks");
    expect(byPath.get("src/auth.mjs")).toContain("scryptSync");
    expect(byPath.get(".gitignore")).toContain("data/");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-sqlite-app-"));
    try {
      for (const file of files) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.mjs"], { cwd: root, timeout: 15_000 });
      await execFileAsync(process.execPath, ["scripts/build.mjs"], { cwd: root, timeout: 10_000 });
      await expect(fs.access(path.join(root, "dist/index.html"))).resolves.toBeUndefined();

      const port = await getFreePort();
      const baseUrl = "http://127.0.0.1:" + port;
      const startServer = () => spawn(process.execPath, ["src/server.mjs"], {
        cwd: root,
        env: { ...process.env, PORT: String(port), NODE_ENV: "test", VOH_DB_PATH: path.join(root, "data", "integration.sqlite") },
        stdio: "ignore",
      });
      let child = startServer();
      try {
        const ready = await waitForHttp(baseUrl + "/api/me", child);
        expect(ready.status).toBe(200);
        expect((await ready.json()).user).toBeNull();
        const crossOrigin = await fetch(baseUrl + "/api/register", { method: "POST", headers: { origin: "https://attacker.invalid", "content-type": "application/json" }, body: JSON.stringify({ email: "bad@example.com", password: "correct horse battery" }) });
        expect(crossOrigin.status).toBe(403);

        const register = async (email: string) => {
          const response = await fetch(baseUrl + "/api/register", { method: "POST", headers: { origin: baseUrl, "content-type": "application/json" }, body: JSON.stringify({ email, password: "correct horse battery" }) });
          expect(response.status).toBe(200);
          return response.headers.get("set-cookie")!.split(";")[0];
        };
        const firstCookie = await register("first@example.com");
        const secondCookie = await register("second@example.com");
        const call = (route: string, cookie: string, method = "GET", payload?: unknown) => fetch(baseUrl + route, {
          method,
          headers: { origin: baseUrl, cookie, "content-type": "application/json" },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        });
        expect((await fetch(baseUrl + "/api/tasks")).status).toBe(401);
        const created = await call("/api/tasks", firstCookie, "POST", { title: "Persist my work" });
        expect(created.status).toBe(201);
        const task = await created.json() as { id: number; title: string; done: number };
        expect(task.title).toBe("Persist my work");
        expect((await call("/api/tasks", secondCookie)).status).toBe(200);
        expect(await (await call("/api/tasks", secondCookie)).json()).toEqual([]);
        const forbiddenUpdate = await call("/api/tasks/" + task.id, secondCookie, "PATCH", { done: true });
        expect(forbiddenUpdate.status).toBe(404);
        const updated = await call("/api/tasks/" + task.id, firstCookie, "PATCH", { done: true });
        expect((await updated.json()).done).toBe(1);
        await stopProcess(child);
        child = startServer();
        await waitForHttp(baseUrl + "/api/me", child);
        const afterRestart = await call("/api/tasks", firstCookie);
        expect(await afterRestart.json()).toMatchObject([{ id: task.id, title: "Persist my work", done: 1 }]);
        const deleted = await call("/api/tasks/" + task.id, firstCookie, "DELETE");
        expect(deleted.status).toBe(200);
        await call("/api/logout", firstCookie, "POST", {});
        expect((await call("/api/tasks", firstCookie)).status).toBe(401);
      } finally {
        await stopProcess(child);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("creates an Electron desktop project with a narrow isolated preload bridge", async () => {
    const template = getTemplate("desktop")!;
    const files = template.files({ ...project, projectType: "desktop", name: "VOH Notes" }, "A private desktop notes app");
    const byPath = new Map(files.map(file => [file.path, file.content]));
    expect(byPath.get("src/main.cjs")).toContain("contextIsolation: true");
    expect(byPath.get("src/main.cjs")).toContain("sandbox: true");
    expect(byPath.get("src/main.cjs")).toContain("nodeIntegration: false");
    expect(byPath.get("src/preload.cjs")).toContain("contextBridge.exposeInMainWorld");
    expect(byPath.get("src/preload.cjs")).not.toContain("require('fs')");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "voh-desktop-"));
    try {
      for (const file of files) {
        const destination = path.join(root, file.path);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, "utf8");
      }
      await execFileAsync(process.execPath, ["scripts/test.cjs"], { cwd: root, timeout: 10_000 });
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

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "node:net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { resumeInterruptedTasks } from "../orchestrator/orchestrator";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { getProjectForOwner } from "../domain/project-service";
import { readWorkspaceAsset } from "../tools/workspace-tools";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const runtimeState = globalThis as typeof globalThis & { __vohServer?: ReturnType<typeof createServer> };

async function waitForPortFree(port: number) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const inUse = await new Promise<boolean>(resolve => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => { socket.destroy(); resolve(false); });
    });
    if (!inUse) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Port ${port} remained in use during a clean server restart`);
}

async function startServer() {
  if (runtimeState.__vohServer?.listening) {
    console.log("Server already listening; keeping the existing watcher instance.");
    return;
  }
  if (runtimeState.__vohServer) {
    await new Promise<void>(resolve => runtimeState.__vohServer?.close(() => resolve()));
    runtimeState.__vohServer = undefined;
  }
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.get(/^\/api\/preview\/(\d+)(?:\/(.*))?$/, async (req, res) => {
    try {
      const context = await createContext({ req, res, info: {} as never });
      if (!context.user) return res.status(401).json({ error: "Authentication required" });
      const projectId = Number(req.params[0]);
      if (!await getProjectForOwner(context.user.id, projectId)) return res.status(404).json({ error: "Project not found" });
      const relativePath = typeof req.params[1] === "string" && req.params[1] ? decodeURIComponent(req.params[1]) : "index.html";
      const asset = await readWorkspaceAsset(projectId, relativePath);
      const contentType = relativePath.endsWith(".html") ? "text/html" : relativePath.endsWith(".css") ? "text/css" : relativePath.endsWith(".js") ? "text/javascript" : "application/octet-stream";
      return res.type(contentType).send(asset.content);
    } catch (error) {
      return res.status(404).json({ error: error instanceof Error ? error.message : "Preview asset not found" });
    }
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  await waitForPortFree(port);
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  runtimeState.__vohServer = server;
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
  void resumeInterruptedTasks();
}

startServer().catch(error => { console.error(error); process.exit(1); });

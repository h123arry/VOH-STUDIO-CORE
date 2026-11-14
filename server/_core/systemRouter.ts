import { sql } from "drizzle-orm";
import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";
import { getDb } from "../db";
import { modelRoutes } from "../models/model-router";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  readiness: protectedProcedure.query(async () => {
    const platformConfigured = Boolean(ENV.appId && ENV.cookieSecret && ENV.oAuthServerUrl);
    let databaseStatus: "ready" | "missing" | "unreachable" = "missing";
    if (ENV.databaseUrl) {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database client unavailable");
        await db.execute(sql`SELECT 1`);
        databaseStatus = "ready";
      } catch {
        databaseStatus = "unreachable";
      }
    }

    const routes = await modelRoutes();
    const coding = routes.find(route => route.role === "coding");
    const reasoning = routes.find(route => route.role === "reasoning");
    const modelReady = Boolean(coding?.modelId && reasoning?.modelId);

    const checks = [
      {
        id: "platform",
        label: "Platform identity and authentication",
        status: platformConfigured ? "ready" as const : "missing" as const,
        detail: platformConfigured ? "Platform authentication settings are present." : "Configure the platform project, OAuth URL, and session secret.",
      },
      {
        id: "database",
        label: "Persistent database",
        status: databaseStatus,
        detail: databaseStatus === "ready" ? "Database connection responded successfully." : databaseStatus === "missing" ? "DATABASE_URL is not configured." : "The configured database did not respond to a readiness query.",
      },
      {
        id: "models",
        label: "AI model gateway",
        status: modelReady ? "ready" as const : "missing" as const,
        detail: modelReady ? "Coding and reasoning model routes are available." : "A coding and reasoning model route could not be resolved. Check the platform model gateway and available model catalog.",
      },
    ];

    return {
      ready: platformConfigured && databaseStatus === "ready" && modelReady,
      checks,
      capabilities: {
        browserWebsites: true,
        browserApps: true,
        browserGames: true,
        mobilePwa: true,
        publicRepositoryImport: true,
        manualSourceEditing: true,
        projectZipExport: true,
        nativeAndroidIosBuilds: false,
        isolatedBackendRuntime: false,
        liveExternalDeployment: false,
      },
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});

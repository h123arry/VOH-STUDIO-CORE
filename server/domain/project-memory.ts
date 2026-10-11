import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { projects, taskEvents, tasks } from "../../drizzle/schema";
import { listProjectFiles } from "./project-service";

export async function buildProjectMemory(projectId: number) {
  const db = await getDb();
  if (!db) return { project: null, files: [], recentTasks: [], recentDecisions: [] };
  const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0] ?? null;
  const recentTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt)).limit(8);
  const recentDecisions = recentTasks.length ? await db.select().from(taskEvents).where(eq(taskEvents.taskId, recentTasks[0].id)).orderBy(desc(taskEvents.createdAt)).limit(12) : [];
  const files = await listProjectFiles(projectId);
  const architecture = files.find(file => /(^|\/)(README|VOH)\.md$/i.test(file.path))?.content?.slice(0, 12000) ?? "No architecture note has been recorded yet.";
  const dependencyManifest = files.find(file => file.path === "package.json")?.content?.slice(0, 12000) ?? "No package manifest has been indexed yet.";
  return { project, files, recentTasks, recentDecisions, architecture, dependencyManifest };
}

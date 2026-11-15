import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { projects, taskEvents, tasks } from "../../drizzle/schema";
import { listProjectFiles } from "./project-service";
import { containsSensitiveValue, isSafeProjectContextFile } from "../security/project-content";

export { containsSensitiveValue } from "../security/project-content";

function savedProjectContext(settings: string | null) {
  if (!settings) return "";
  try {
    const value: unknown = JSON.parse(settings).projectMemory;
    return typeof value === "string" && !containsSensitiveValue(value)
      ? value.trim().slice(0, 4000)
      : "";
  } catch {
    return "";
  }
}

export async function buildProjectMemory(projectId: number) {
  const db = await getDb();
  if (!db) return { project: null, files: [], recentTasks: [], recentDecisions: [], savedContext: "" };
  const projectRow = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0] ?? null;
  const project = projectRow ? { ...projectRow, name: containsSensitiveValue(projectRow.name) ? "Project" : projectRow.name, description: containsSensitiveValue(projectRow.description) ? "" : projectRow.description } : null;
  const recentTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt)).limit(8);
  const recentDecisions = recentTasks.length ? (await db.select().from(taskEvents).where(inArray(taskEvents.taskId, recentTasks.map(task => task.id))).orderBy(desc(taskEvents.createdAt), desc(taskEvents.id)).limit(24)).filter(event => !containsSensitiveValue(event.summary)) : [];
  const files = (await listProjectFiles(projectId)).filter(file => isSafeProjectContextFile(file.path, file.content ?? ""));
  const architecture = files.find(file => /(^|\/)(README|VOH)\.md$/i.test(file.path))?.content?.slice(0, 12000) ?? "No architecture note has been recorded yet.";
  const dependencyManifest = files.find(file => file.path === "package.json")?.content?.slice(0, 12000) ?? "No package manifest has been indexed yet.";
  return { project, files, recentTasks, recentDecisions, architecture, dependencyManifest, savedContext: savedProjectContext(project?.settings ?? null) };
}

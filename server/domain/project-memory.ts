import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { projects, taskEvents, tasks } from "../../drizzle/schema";
import { listProjectFiles } from "./project-service";

export function containsSensitiveValue(value: string) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)
    || /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/.test(value)
    || /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|secret|password|passwd|bearer|refresh[_-]?token)\s*[:=]\s*["']?[^\s"',;]{8,}/i.test(value);
}

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
  const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0] ?? null;
  const recentTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt)).limit(8);
  const recentDecisions = recentTasks.length ? await db.select().from(taskEvents).where(inArray(taskEvents.taskId, recentTasks.map(task => task.id))).orderBy(desc(taskEvents.createdAt), desc(taskEvents.id)).limit(24) : [];
  const files = await listProjectFiles(projectId);
  const architecture = files.find(file => /(^|\/)(README|VOH)\.md$/i.test(file.path))?.content?.slice(0, 12000) ?? "No architecture note has been recorded yet.";
  const dependencyManifest = files.find(file => file.path === "package.json")?.content?.slice(0, 12000) ?? "No package manifest has been indexed yet.";
  return { project, files, recentTasks, recentDecisions, architecture, dependencyManifest, savedContext: savedProjectContext(project?.settings ?? null) };
}

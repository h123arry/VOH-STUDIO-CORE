import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { projects, projectFiles } from "../../drizzle/schema";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "untitled-project";

export async function createProject(ownerId: number, input: { name: string; description: string; projectType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const slug = `${slugify(input.name)}-${Date.now().toString(36)}`;
  const workspacePath = `workspace-data/project-${ownerId}-${Date.now().toString(36)}`;
  const result = await db.insert(projects).values({ ownerId, name: input.name.trim(), slug, description: input.description.trim(), projectType: input.projectType, workspacePath, settings: JSON.stringify({ developerMode: false, commandPolicy: "safe" }) });
  const id = Number((result as unknown as { insertId: number }).insertId);
  await db.update(projects).set({ workspacePath: `workspace-data/project-${id}` }).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
  const rows = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId))).limit(1);
  return rows[0];
}

export async function listProjects(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(and(eq(projects.ownerId, ownerId), eq(projects.lifecycle, "active"))).orderBy(desc(projects.updatedAt));
}

export async function getProjectForOwner(ownerId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  return rows[0];
}

export async function updateProjectTask(projectId: number, ownerId: number, activeTaskId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(projects).set({ activeTaskId }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
}

export async function updateProjectSettings(projectId: number, ownerId: number, settings: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(projects).set({ settings: JSON.stringify(settings) }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
}

export async function upsertProjectFile(input: { projectId: number; path: string; language?: string; contentHash: string; size: number; content?: string; lastOperation: string }) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: projectFiles.id }).from(projectFiles).where(and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.path, input.path))).limit(1);
  if (existing[0]) {
    await db.update(projectFiles).set(input).where(eq(projectFiles.id, existing[0].id));
  } else {
    await db.insert(projectFiles).values(input);
  }
}

export async function listProjectFiles(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(projectFiles.path);
}

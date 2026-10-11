import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { taskArtifacts } from "../../drizzle/schema";

export async function recordArtifact(input: typeof taskArtifacts.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(taskArtifacts).values(input);
}

export async function listArtifacts(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskArtifacts).where(eq(taskArtifacts.taskId, taskId)).orderBy(desc(taskArtifacts.createdAt));
}

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { agentRuns, taskErrors, taskEvents, taskInstructions, taskSteps, tasks, toolCalls, verificationRuns } from "../../drizzle/schema";

export async function createTask(input: { projectId: number; ownerId: number; objective: string; viewMode: "simple" | "developer" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(tasks).values({ projectId: input.projectId, ownerId: input.ownerId, objective: input.objective.trim(), userRequest: input.objective.trim(), viewMode: input.viewMode });
  const id = Number((result as unknown as { insertId: number }).insertId);
  const rows = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerId, input.ownerId))).limit(1);
  return rows[0];
}

export async function getTaskForOwner(ownerId: number, taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.ownerId, ownerId))).limit(1);
  return rows[0];
}

export async function listTasks(ownerId: number, projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(and(eq(tasks.ownerId, ownerId), eq(tasks.projectId, projectId))).orderBy(desc(tasks.createdAt));
}

export async function updateTask(taskId: number, values: Partial<typeof tasks.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(tasks).set(values).where(eq(tasks.id, taskId));
}

export async function isTaskCancelled(taskId: number) {
  const db = await getDb();
  if (!db) return false;
  const row = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return row[0]?.status === "cancelled";
}

export async function isTaskPaused(taskId: number) { const db = await getDb(); if (!db) return false; const row = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, taskId)).limit(1); return row[0]?.status === "paused"; }
export async function queueTaskInstruction(input: { projectId: number; taskId: number; ownerId: number; instruction: string }) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const result = await db.insert(taskInstructions).values({ ...input, instruction: input.instruction.trim() }); const id = Number((result as unknown as { insertId: number }).insertId); return { id, ...input, status: "queued" as const }; }
export async function listQueuedInstructions(projectId: number, taskId?: number) { const db = await getDb(); if (!db) return []; return db.select().from(taskInstructions).where(taskId ? and(eq(taskInstructions.projectId, projectId), eq(taskInstructions.taskId, taskId), eq(taskInstructions.status, "queued")) : and(eq(taskInstructions.projectId, projectId), eq(taskInstructions.status, "queued"))).orderBy(asc(taskInstructions.createdAt)); }
export async function markInstruction(input: { id: number; status: "processing" | "completed" | "cancelled" }) { const db = await getDb(); if (!db) return; await db.update(taskInstructions).set({ status: input.status, processedAt: input.status === "completed" || input.status === "cancelled" ? new Date() : undefined }).where(eq(taskInstructions.id, input.id)); }

export async function addTaskSteps(taskId: number, steps: Array<{ phase: string; title: string; assignedAgent: string; inputSummary?: string }>) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: taskSteps.id }).from(taskSteps).where(eq(taskSteps.taskId, taskId)).limit(1);
  if (existing.length > 0) return;
  await db.insert(taskSteps).values(steps.map((step, index) => ({ taskId, orderIndex: index, ...step })));
}

export async function listTaskSteps(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(asc(taskSteps.orderIndex));
}

export async function updateStep(stepId: number, values: Partial<typeof taskSteps.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(taskSteps).set(values).where(eq(taskSteps.id, stepId));
}

export async function appendTaskEvent(input: { taskId: number; eventType: string; actor: string; phase: string; summary: string; severity?: "info" | "success" | "warning" | "error"; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(taskEvents).values({ ...input, severity: input.severity ?? "info", metadata: input.metadata ? JSON.stringify(input.metadata) : undefined });
}

export async function listTaskEvents(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId)).orderBy(desc(taskEvents.createdAt));
}

export async function recordAgentRun(input: typeof agentRuns.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(agentRuns).values(input);
}

export async function listAgentRuns(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentRuns).where(eq(agentRuns.taskId, taskId)).orderBy(desc(agentRuns.startedAt));
}

export async function recordToolCall(input: typeof toolCalls.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(toolCalls).values(input);
}

export async function listToolCalls(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(toolCalls).where(eq(toolCalls.taskId, taskId)).orderBy(desc(toolCalls.createdAt));
}

export async function recordError(input: typeof taskErrors.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(taskErrors).values(input);
}

export async function listErrors(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskErrors).where(eq(taskErrors.taskId, taskId)).orderBy(desc(taskErrors.createdAt));
}

export async function recordVerification(input: typeof verificationRuns.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(verificationRuns).values(input);
}

export async function listVerifications(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(verificationRuns).where(eq(verificationRuns.taskId, taskId)).orderBy(desc(verificationRuns.createdAt));
}

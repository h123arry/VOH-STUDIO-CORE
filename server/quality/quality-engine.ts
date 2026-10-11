import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { listProjectFiles } from "../domain/project-service";
import { qualityScores } from "../../drizzle/schema";

export type QualityReport = { functionality: number; design: number; performance: number; security: number; reliability: number; accessibility: number; testCoverage: number; codeQuality: number; responsiveness: number; total: number; threshold: number; recommendations: string[] };
export function evaluateQuality(files: Array<{ path: string; content?: string | null; size: number }>, checks: { buildPassed: boolean; testsPassed: boolean; retries: number }): QualityReport {
  const text = files.map(file => file.content ?? "").join("\n"); const html = files.filter(file => file.path.endsWith(".html")).map(file => file.content ?? "").join("\n"); const totalBytes = files.reduce((sum, file) => sum + file.size, 0); const recommendations: string[] = [];
  const functionality = checks.buildPassed ? 92 : 35; const reliability = checks.retries === 0 ? 92 : Math.max(60, 92 - checks.retries * 12); const testCoverage = checks.testsPassed ? 86 : 35;
  const design = files.some(file => /\.css$|tailwind|theme/i.test(file.path)) ? 86 : 58;
  const performance = totalBytes < 250_000 ? 90 : totalBytes < 1_000_000 ? 72 : 48;
  const security = /eval\s*\(|innerHTML\s*=|child_process\.exec\(/.test(text) ? 42 : 91;
  const accessibility = /<html[^>]+lang=|<main\b|aria-label=/.test(html) ? 88 : 62;
  const codeQuality = files.some(file => file.path === "package.json") && files.some(file => /\.(ts|tsx|js|jsx)$/.test(file.path)) ? 86 : 65;
  const responsiveness = /viewport|@media|grid|flex/.test(text) ? 88 : 60;
  if (performance < 80) recommendations.push("Reduce shipped asset size and defer non-critical code.");
  if (accessibility < 80) recommendations.push("Add semantic landmarks, labels, and document language metadata.");
  if (security < 80) recommendations.push("Remove dynamic code execution and unsafe HTML sinks.");
  if (testCoverage < 80) recommendations.push("Add focused tests for the primary user flows.");
  const dimensions = [functionality, design, performance, security, reliability, accessibility, testCoverage, codeQuality, responsiveness]; const total = Math.round(dimensions.reduce((sum, score) => sum + score, 0) / dimensions.length);
  return { functionality, design, performance, security, reliability, accessibility, testCoverage, codeQuality, responsiveness, total, threshold: 75, recommendations };
}
export async function scoreTask(input: { taskId: number; projectId: number; buildPassed: boolean; testsPassed: boolean; retries: number }) {
  const files = await listProjectFiles(input.projectId); const report = evaluateQuality(files, input); const db = await getDb();
  if (db) await db.insert(qualityScores).values({ ...report, taskId: input.taskId, projectId: input.projectId, recommendations: JSON.stringify(report.recommendations) });
  return report;
}
export async function latestQualityScore(projectId: number, taskId?: number) { const db = await getDb(); if (!db) return null; const rows = await db.select().from(qualityScores).where(eq(qualityScores.projectId, projectId)).orderBy(desc(qualityScores.createdAt)).limit(10); return taskId ? rows.find(row => row.taskId === taskId) ?? null : rows[0] ?? null; }

import { performance } from "node:perf_hooks";
import { getTemplate } from "../templates/registry";
import { buildExecutionPlan, classifyComplexity } from "../orchestrator/planning-engine";

export const BENCHMARK_CASES = [
  { key: "landing-page", objective: "Build a modern landing page for a creator tool." },
  { key: "dashboard", objective: "Build a responsive analytics dashboard with filters." },
  { key: "crud", objective: "Build a CRUD application with authentication and database persistence." },
  { key: "rest-api", objective: "Build a REST API with validation and tests." },
  { key: "saas", objective: "Build an authenticated SaaS application with billing boundaries." },
  { key: "modify", objective: "Modify the existing profile page and add dark mode." },
  { key: "repair", objective: "Fix a broken project and verify the build." },
  { key: "mobile-scaffold", objective: "Create a mobile application scaffold for Android and iOS." },
  { key: "game-prototype", objective: "Create a multiplayer game prototype with physics and save systems." },
] as const;
export type BenchmarkResult = { key: string; complexity: string; planningMs: number; unitCount: number; parallelUnits: number; capabilityCount: number; fastPath: boolean };
export function runPlanningBenchmarks(): BenchmarkResult[] { return BENCHMARK_CASES.map(item => { const start = performance.now(); const plan = buildExecutionPlan(item.objective); const planningMs = Math.round((performance.now() - start) * 100) / 100; return { key: item.key, complexity: classifyComplexity(item.objective), planningMs, unitCount: plan.units.length, parallelUnits: plan.parallelGroups.length, capabilityCount: plan.capabilities.length, fastPath: plan.complexity === "simple" }; }); }
export function benchmarkTemplateGeneration() { const template = getTemplate("website"); const start = performance.now(); const files = template ? template.files({ id: 1, ownerId: 1, name: "Benchmark", slug: "benchmark", description: "Benchmark", projectType: "website", lifecycle: "active", workspacePath: "workspace-data/project-1", activeTaskId: null, settings: null, createdAt: new Date(), updatedAt: new Date() }, "Build a benchmark site") : []; return { generationMs: Math.round((performance.now() - start) * 100) / 100, fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.content.length, 0) }; }
if (process.argv[1]?.endsWith("benchmarks.ts")) console.log(JSON.stringify({ cases: runPlanningBenchmarks(), template: benchmarkTemplateGeneration() }, null, 2));

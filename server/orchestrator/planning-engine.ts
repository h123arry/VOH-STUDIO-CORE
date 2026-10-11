export type Complexity = "simple" | "medium" | "large";
export type Capability = "web" | "mobile" | "game" | "ai" | "backend" | "database" | "automation" | "cloud" | "data" | "media" | "commerce" | "fintech" | "social" | "productivity" | "developer-tools";
export type PlannedUnit = { id: string; title: string; agent: string; capability: Capability; dependsOn: string[]; parallel: boolean };

const terms = (objective: string) => objective.toLowerCase();
export function classifyComplexity(objective: string): Complexity {
  const value = terms(objective);
  const large = ["multiplayer", "fintech", "enterprise", "social network", "complex ai", "realtime", "payment", "game engine", "large platform"].some(term => value.includes(term));
  if (large || objective.length > 1800) return "large";
  const medium = ["saas", "marketplace", "social app", "api platform", "authentication", "database", "dashboard", "mobile", "game", "automation"].some(term => value.includes(term));
  return medium || objective.length > 500 ? "medium" : "simple";
}
export function detectCapabilities(objective: string): Capability[] {
  const value = terms(objective); const capabilities: Capability[] = [];
  const map: Array<[Capability, string[]]> = [["web", ["website", "landing", "frontend", "web app", "dashboard"]], ["mobile", ["mobile", "android", "ios", "react native"]], ["game", ["game", "multiplayer", "physics", "npc"]], ["ai", ["ai", "assistant", "model", "rag", "chatbot"]], ["backend", ["api", "backend", "server", "webhook"]], ["database", ["database", "crud", "persist", "schema"]], ["automation", ["automation", "workflow", "schedule", "bot"]], ["cloud", ["deploy", "cloud", "storage"]], ["data", ["analytics", "csv", "etl", "data"]], ["media", ["video", "audio", "image", "media"]], ["commerce", ["store", "commerce", "cart", "checkout"]], ["fintech", ["fintech", "banking", "ledger"]], ["social", ["social", "creator", "community"]], ["productivity", ["calendar", "notes", "project management"]], ["developer-tools", ["developer", "code", "repo", "cli"]]];
  for (const [capability, hints] of map) if (hints.some(hint => value.includes(hint))) capabilities.push(capability);
  return capabilities.length ? [...new Set(capabilities)] : ["web"];
}
export function buildExecutionPlan(objective: string) {
  const complexity = classifyComplexity(objective); const capabilities = detectCapabilities(objective);
  const units: PlannedUnit[] = [{ id: "architect", title: "Define architecture, risks, contracts, and design direction", agent: "architect", capability: capabilities[0], dependsOn: [], parallel: false }];
  const add = (id: string, title: string, agent: string, capability: Capability, dependsOn: string[] = ["architect"]) => units.push({ id, title, agent, capability, dependsOn, parallel: dependsOn.length > 0 });
  if (complexity !== "simple" || capabilities.includes("backend")) add("backend", "Implement service boundaries and API contracts", "backend", "backend");
  if (complexity !== "simple" || capabilities.includes("database")) add("database", "Design persistence, indexes, and ownership rules", "database", "database");
  add("frontend", "Build the product interface and responsive experience", "frontend", "web");
  if (complexity === "large" || capabilities.includes("media") || capabilities.includes("game")) add("assets", "Prepare asset and interaction requirements", "asset", capabilities.includes("game") ? "game" : "media");
  add("documentation", "Record decisions, routes, setup, and operator notes", "documentation", "developer-tools");
  add("qa", "Run build, tests, security, accessibility, and performance checks", "qa", "developer-tools", units.filter(unit => unit.id !== "qa").map(unit => unit.id));
  return { complexity, capabilities, units, parallelGroups: units.filter(unit => unit.parallel && unit.id !== "qa").map(unit => unit.id), sequential: units.filter(unit => !unit.parallel).map(unit => unit.id) };
}
export function executionProfile(complexity: Complexity) { return complexity === "simple" ? { mode: "fast", maxRetries: 1, preferredModel: "fast" } : complexity === "medium" ? { mode: "multi-agent", maxRetries: 2, preferredModel: "coding" } : { mode: "full-orchestration", maxRetries: 3, preferredModel: "reasoning" }; }

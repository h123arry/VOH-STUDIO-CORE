import { AGENT_REGISTRY } from "./registry";

const signals: Array<{ agent: string; terms: string[] }> = [
  { agent: "database", terms: ["database", "schema", "sql", "data", "migration"] },
  { agent: "backend", terms: ["api", "backend", "server", "webhook", "endpoint"] },
  { agent: "frontend", terms: ["website", "web app", "ui", "dashboard", "page", "frontend"] },
  { agent: "mobile", terms: ["ios", "android", "mobile", "expo"] },
  { agent: "game", terms: ["game", "multiplayer", "level", "player"] },
  { agent: "ai", terms: ["ai", "llm", "assistant", "model", "agent"] },
  { agent: "security", terms: ["auth", "security", "permissions", "secret", "payments"] },
  { agent: "research", terms: ["research", "compare", "find", "latest"] },
  { agent: "asset", terms: ["image", "asset", "logo", "illustration"] },
];

export function selectAgents(objective: string) {
  const text = objective.toLowerCase();
  const keys = new Set(["orchestrator", "architect", "qa", "debugger", "documentation"]);
  for (const signal of signals) if (signal.terms.some(term => text.includes(term))) keys.add(signal.agent);
  return AGENT_REGISTRY.filter(agent => keys.has(agent.key));
}

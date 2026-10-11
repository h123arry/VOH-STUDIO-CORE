export type AgentExecutorStatus = "active" | "registered" | "approval_required";
export type AgentDefinition = {
  key: string;
  name: string;
  capabilityClass: string;
  executorStatus: AgentExecutorStatus;
  modelRole?: string;
  safetyScope: string;
  description: string;
};

export const AGENT_REGISTRY: AgentDefinition[] = [
  { key: "orchestrator", name: "VOH Orchestrator", capabilityClass: "coordination", executorStatus: "active", modelRole: "reasoning", safetyScope: "task lifecycle, planning, retries", description: "Owns lifecycle transitions and delegates work without exposing hidden reasoning." },
  { key: "architect", name: "Architect Agent", capabilityClass: "architecture", executorStatus: "active", modelRole: "reasoning", safetyScope: "read project context, write plans", description: "Turns objectives into structured requirements and an executable plan." },
  { key: "frontend", name: "Frontend Agent", capabilityClass: "implementation", executorStatus: "active", modelRole: "coding", safetyScope: "workspace files within project root", description: "Can inspect and edit frontend files through the bounded workspace tools." },
  { key: "backend", name: "Backend Agent", capabilityClass: "implementation", executorStatus: "registered", modelRole: "coding", safetyScope: "workspace files within project root", description: "Registered for server implementation adapters." },
  { key: "database", name: "Database Agent", capabilityClass: "data", executorStatus: "approval_required", modelRole: "reasoning", safetyScope: "read schema; destructive SQL requires approval", description: "Can reason about schemas; destructive data operations are gated." },
  { key: "mobile", name: "Mobile Agent", capabilityClass: "mobile", executorStatus: "registered", modelRole: "coding", safetyScope: "workspace files within project root", description: "Registered for mobile project runtimes." },
  { key: "game", name: "Game Development Agent", capabilityClass: "game", executorStatus: "registered", modelRole: "coding", safetyScope: "workspace files within project root", description: "Registered for game templates and engine adapters." },
  { key: "ai", name: "AI Agent", capabilityClass: "ai", executorStatus: "registered", modelRole: "reasoning", safetyScope: "workspace files and model routes", description: "Registered for AI application composition." },
  { key: "uiux", name: "UI/UX Agent", capabilityClass: "design", executorStatus: "registered", modelRole: "vision", safetyScope: "workspace files and visual checks", description: "Registered for interface and visual review adapters." },
  { key: "devops", name: "DevOps Agent", capabilityClass: "delivery", executorStatus: "approval_required", modelRole: "reasoning", safetyScope: "deployment preparation; production deploy gated", description: "Can prepare delivery configuration; production changes require approval." },
  { key: "qa", name: "QA Agent", capabilityClass: "verification", executorStatus: "active", modelRole: "fast", safetyScope: "run bounded project checks", description: "Runs allowed verification commands and records evidence." },
  { key: "security", name: "Security Agent", capabilityClass: "review", executorStatus: "registered", modelRole: "reasoning", safetyScope: "read-only inspection", description: "Registered for policy and vulnerability review adapters." },
  { key: "debugger", name: "Debugger Agent", capabilityClass: "recovery", executorStatus: "active", modelRole: "coding", safetyScope: "read diagnostics; patch within project root", description: "Classifies failures and proposes targeted bounded recovery." },
  { key: "research", name: "Research Agent", capabilityClass: "research", executorStatus: "registered", modelRole: "research", safetyScope: "network access only through approved adapters", description: "Registered for web research adapters." },
  { key: "asset", name: "Asset Agent", capabilityClass: "assets", executorStatus: "registered", modelRole: "image", safetyScope: "generated assets in project storage", description: "Registered for image and asset generation adapters." },
  { key: "documentation", name: "Documentation Agent", capabilityClass: "documentation", executorStatus: "active", modelRole: "fast", safetyScope: "workspace markdown files", description: "Captures concise operator-facing project documentation." },
];

import { z } from "zod";

export type ToolRisk = "low" | "medium" | "high";
export type ToolDefinition = { name: string; description: string; schema: z.ZodTypeAny; permissions: string[]; timeoutMs: number; risk: ToolRisk; executorStatus: "active" | "approval_required" | "registered" };

export const TOOL_REGISTRY: ToolDefinition[] = [
  { name: "workspace.listFiles", description: "Index project-relative files inside the isolated workspace.", schema: z.object({ projectId: z.number().int().positive() }), permissions: ["workspace.read"], timeoutMs: 10_000, risk: "low", executorStatus: "active" },
  { name: "workspace.readFile", description: "Read a bounded text file from the isolated workspace.", schema: z.object({ projectId: z.number().int().positive(), path: z.string() }), permissions: ["workspace.read"], timeoutMs: 10_000, risk: "low", executorStatus: "active" },
  { name: "workspace.writeFile", description: "Create or update a project-relative text file.", schema: z.object({ projectId: z.number().int().positive(), path: z.string(), content: z.string() }), permissions: ["workspace.write"], timeoutMs: 15_000, risk: "medium", executorStatus: "active" },
  { name: "project.inspect", description: "Inspect the project manifest and source tree without running code.", schema: z.object({ projectId: z.number().int().positive() }), permissions: ["workspace.read"], timeoutMs: 15_000, risk: "low", executorStatus: "active" },
  { name: "project.install", description: "Install declared dependencies inside the isolated workspace.", schema: z.object({ projectId: z.number().int().positive() }), permissions: ["workspace.write", "network.package"], timeoutMs: 120_000, risk: "medium", executorStatus: "active" },
  { name: "project.build", description: "Run the declared build command inside the isolated workspace.", schema: z.object({ projectId: z.number().int().positive(), command: z.string() }), permissions: ["workspace.execute"], timeoutMs: 60_000, risk: "medium", executorStatus: "active" },
  { name: "project.test", description: "Run the declared test command inside the isolated workspace.", schema: z.object({ projectId: z.number().int().positive(), command: z.string() }), permissions: ["workspace.execute"], timeoutMs: 60_000, risk: "medium", executorStatus: "active" },
  { name: "computer.terminal", description: "Execute a policy-checked command in the project workspace.", schema: z.object({ projectId: z.number().int().positive(), command: z.string() }), permissions: ["workspace.execute"], timeoutMs: 60_000, risk: "medium", executorStatus: "active" },
  { name: "computer.browserCapture", description: "Capture an owned local preview for visual inspection; external sites are not modified.", schema: z.object({ projectId: z.number().int().positive(), path: z.string() }), permissions: ["workspace.read", "preview.capture"], timeoutMs: 30_000, risk: "medium", executorStatus: "registered" },
  { name: "computer.launchRuntime", description: "Start a project-local development runtime under bounded process policy.", schema: z.object({ projectId: z.number().int().positive() }), permissions: ["workspace.execute"], timeoutMs: 30_000, risk: "medium", executorStatus: "registered" },
  { name: "project.deploy", description: "Prepare or execute a production deployment.", schema: z.object({ projectId: z.number().int().positive() }), permissions: ["deployment.production"], timeoutMs: 120_000, risk: "high", executorStatus: "approval_required" },
];

export function toolsForAgent(agentKey: string) {
  const safe = TOOL_REGISTRY.filter(tool => tool.risk !== "high");
  if (agentKey === "qa") return safe.filter(tool => tool.name.includes("inspect") || tool.name.includes("build") || tool.name.includes("test"));
  if (agentKey === "documentation") return safe.filter(tool => tool.name.includes("read") || tool.name.includes("list"));
  if (agentKey === "devops") return safe;
  return safe;
}

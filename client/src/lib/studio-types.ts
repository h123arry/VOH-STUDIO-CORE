import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type Project = RouterOutputs["projects"]["list"][number];
export type ProjectDetail = NonNullable<RouterOutputs["projects"]["get"]>;
export type TaskBundle = NonNullable<RouterOutputs["tasks"]["get"]>;
export type Task = TaskBundle["task"];
export type TaskStep = TaskBundle["steps"][number];
export type TaskEvent = TaskBundle["events"][number];
export type AgentRun = TaskBundle["agents"][number];
export type Verification = TaskBundle["verifications"][number];
export type ToolCall = TaskBundle["toolCalls"][number];
export type QualityScore = NonNullable<TaskBundle["quality"]>;

export const phaseLabel = (phase?: string | null) => ({ plan: "Plan", build: "Build", run: "Run", test: "Test", inspect: "Inspect", debug: "Debug", patch: "Patch", rebuild: "Rebuild", retest: "Retest", complete: "Complete", failed: "Escalated" }[phase ?? ""] ?? "Queued");
export const statusTone = (status?: string | null) => status === "completed" || status === "passed" ? "success" : status === "failed" || status === "error" ? "danger" : ["queued", "planning", "running", "waiting", "testing", "debugging"].includes(status ?? "") ? "active" : status === "paused" || status === "skipped" ? "muted" : "neutral";
export const timeAgo = (value?: Date | string | null) => { if (!value) return "—"; const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return `${seconds}s ago`; const minutes = Math.round(seconds / 60); if (minutes < 60) return `${minutes}m ago`; return `${Math.round(minutes / 60)}h ago`; };
export const fileLanguage = (path: string) => { const ext = path.split(".").pop()?.toLowerCase(); return ({ ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX", md: "Markdown", json: "JSON", css: "CSS" } as Record<string, string>)[ext ?? ""] ?? "Text"; };

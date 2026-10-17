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
export type TemplateKind = RouterOutputs["templates"]["list"][number]["kind"];
export type ExecutionMode = "chat" | "plan" | "build" | "build_more";

export const phaseLabel = (phase?: string | null) =>
  ({
    plan: "Plan",
    build: "Build",
    run: "Run",
    test: "Test",
    inspect: "Inspect",
    debug: "Debug",
    patch: "Patch",
    rebuild: "Rebuild",
    retest: "Retest",
    complete: "Complete",
    failed: "Escalated",
  })[phase ?? ""] ?? "Queued";
export const statusTone = (status?: string | null) =>
  status === "completed" || status === "passed"
    ? "success"
    : status === "failed" || status === "error"
      ? "danger"
      : [
            "queued",
            "planning",
            "running",
            "waiting",
            "testing",
            "debugging",
          ].includes(status ?? "")
        ? "active"
        : status === "paused" || status === "skipped"
          ? "muted"
          : "neutral";
export const taskActivity = (
  task?: Task,
  events: TaskEvent[] = [],
  toolCalls: ToolCall[] = []
): { label: string; tone: string } => {
  if (!task) return { label: "VOH AI is ready", tone: "neutral" };
  if (task.status === "cancelled")
    return { label: "VOH AI task cancelled", tone: "muted" };
  if (task.status === "failed")
    return { label: "VOH AI encountered an execution failure", tone: "danger" };
  if (task.status === "completed")
    return {
      label:
        task.executionMode === "chat"
          ? "VOH AI finished responding"
          : "VOH AI finalized the result",
      tone: "success",
    };
  if (task.status === "paused")
    return { label: "VOH AI is paused", tone: "muted" };
  if (task.status === "queued")
    return { label: "VOH AI is queued", tone: "active" };
  if (
    task.status === "waiting" &&
    task.executionMode === "plan" &&
    !task.approvedPlan
  )
    return { label: "VOH AI is waiting for plan approval", tone: "active" };
  if (task.status === "waiting")
    return { label: "VOH AI is waiting", tone: "active" };
  const activeTool =
    toolCalls[0]?.status === "started" &&
    !["task.started", "task.resumed"].includes(events[0]?.eventType ?? "")
      ? toolCalls[0]
      : undefined;
  if (activeTool?.toolName === "workspace.writeFile")
    return { label: "VOH AI is editing code...", tone: "active" };
  if (activeTool?.toolName === "project.install")
    return { label: "VOH AI is running commands...", tone: "active" };
  if (activeTool?.toolName.startsWith("project."))
    return { label: "VOH AI is testing...", tone: "active" };
  const latest = events[0]?.eventType;
  const liveEvent = (
    {
      "project.inspection.started": "VOH AI is inspecting your project",
      "model.request.started": "VOH AI is thinking",
      "source.generation.started": "VOH AI is editing code",
      "command.started": "VOH AI is running commands",
      "verification.started": "VOH AI is testing",
      "quality.evaluation.started": "VOH AI is evaluating",
    } as Record<string, string>
  )[latest ?? ""];
  if (liveEvent) return { label: `${liveEvent}...`, tone: "active" };
  const phase = task.currentPhase;
  const label =
    phase === "plan"
      ? "VOH AI is planning"
      : phase === "inspect"
        ? "VOH AI is inspecting your project"
        : phase === "build"
          ? "VOH AI is building"
          : phase === "run"
            ? "VOH AI is running commands"
            : phase === "test" || phase === "retest"
              ? "VOH AI is testing"
              : phase === "debug" || phase === "patch"
                ? "VOH AI is fixing an issue"
                : phase === "complete"
                  ? "VOH AI is finalizing the result"
                  : "VOH AI is working";
  return { label: `${label}...`, tone: "active" };
};
export const timeAgo = (value?: Date | string | null) => {
  if (!value) return "—";
  const seconds = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 1000)
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};
export const fileLanguage = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        ts: "TypeScript",
        tsx: "TSX",
        js: "JavaScript",
        jsx: "JSX",
        md: "Markdown",
        json: "JSON",
        css: "CSS",
      } as Record<string, string>
    )[ext ?? ""] ?? "Text"
  );
};

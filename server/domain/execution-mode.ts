export type ExecutionMode = "chat" | "plan" | "build" | "build_more";

export function executionModePolicy(mode: ExecutionMode) {
  return {
    readOnly: mode === "chat",
    requiresPlanApproval: mode === "plan",
    requiresProject: mode !== "build",
    requiresImplementation: mode === "build_more",
    preserveExistingProject: mode === "build_more",
  };
}

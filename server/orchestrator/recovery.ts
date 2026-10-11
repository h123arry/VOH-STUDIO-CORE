export type FailureClass = "compiler" | "runtime" | "test" | "dependency" | "configuration" | "api" | "ui" | "build" | "policy" | "unknown";

export function classifyFailure(output: string): FailureClass {
  const value = output.toLowerCase();
  if (value.includes("blocked by the workspace safety policy")) return "policy";
  if (value.includes("cannot find module") || value.includes("package") && value.includes("not found")) return "dependency";
  if (value.includes("tsc") || value.includes("typescript") || value.includes("syntaxerror")) return "compiler";
  if (value.includes("test") || value.includes("assert")) return "test";
  if (value.includes("eaddrinuse") || value.includes("runtime")) return "runtime";
  if (value.includes("config") || value.includes("environment")) return "configuration";
  if (value.includes("fetch") || value.includes("api") || value.includes("http")) return "api";
  if (value.includes("vite") || value.includes("build")) return "build";
  return "unknown";
}

export function recoverySummary(failureClass: FailureClass) {
  const summaries: Record<FailureClass, string> = {
    compiler: "Inspect the compiler diagnostic and patch only the affected workspace files.",
    runtime: "Inspect the runtime log, reproduce within the bounded workspace, then patch the failing path.",
    test: "Inspect the failed assertion and update implementation or test assumptions before retesting.",
    dependency: "Inspect the manifest and lockfile; dependency changes require an explicit environment approval.",
    configuration: "Inspect environment and project configuration without reading secrets.",
    api: "Inspect the API response and retry policy; do not repeat an unchanged malformed request.",
    ui: "Inspect the rendered surface and patch the affected component or style.",
    build: "Inspect the build output and patch the smallest affected module before rebuilding.",
    policy: "Stop and request an approval; the requested action exceeds the current workspace policy.",
    unknown: "Capture the diagnostic, stop after the retry limit, and escalate with the evidence collected.",
  };
  return summaries[failureClass];
}

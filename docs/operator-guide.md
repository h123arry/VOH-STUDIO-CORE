# VOH STUDIO operator guide

1. Sign in to VOH STUDIO and create a workspace with a name, description, and project type.
2. Describe the outcome in the objective composer. Open **Preview execution plan** to review the inferred work mode, capabilities, specialist roles, workflow, and sensitive-action warnings before running. The preview is advisory; it does not itself authorize or block protected actions. Choose Simple view for the verified summary or Developer view for tool calls and diagnostics.
3. VOH persists the task, creates a structured plan, initializes a workspace manifest and README, inspects the workspace, and runs build/test only when a real package manifest provides those commands.
4. Follow the center plan stream and activity timeline. The inspector shows the current phase, agent activity, verification status, and retry budget.
5. Open Developer view to inspect safe tool output and classified failures. A failed task remains durable and can be retried from the task controls when the UI exposes that action.
6. Follow-up objectives should be submitted with the relevant project selected. VOH continues that workspace rather than silently creating a new project.

A completed task means the recorded scope passed the checks VOH could actually run. It does not mean every requested product adapter exists; the final summary and timeline state what was verified.

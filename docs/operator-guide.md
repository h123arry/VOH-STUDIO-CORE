# VOH STUDIO operator guide

1. Sign in to VOH STUDIO and create a workspace with a name, description, and project type.
2. Select a composer execution mode:
   - **Chat** asks VOH AI a read-only question using project-scoped context. It does not run workspace commands or write project files.
   - **Plan** inspects the selected workspace, saves an editable implementation plan, then waits. No implementation starts until **Approve & build** is selected; the approved text is passed to the execution engine.
   - **Build** executes the request through the existing orchestrator and can create a workspace from an executable starter.
   - **Build More** requires an existing implementation, includes eligible existing source files as context, and writes only source files that differ from their current contents. If no source change is generated, the existing files are left untouched and the task fails visibly.
   Chat, Plan, and Build More require an existing project. The selected mode is remembered in this browser; the mode used for each task is persisted on the task record.
3. Attach up to five text/code files (64 KB each) to include bounded reference context. PDF and image interpretation is not enabled yet. For Build, the optional **Preview execution plan** shows an advisory plan before submission.
4. Task activity uses persisted phase and execution events; the expandable Activity timeline shows recorded events and timestamps. Active task state is reloaded from the server, and an approval-waiting Plan task does not poll continuously.
5. The inspector exposes verification records and bounded retries. Cancel requests update the persisted task and send a termination signal to supported active workspace commands. A non-cancellable in-flight model request can finish before the orchestrator observes the cancellation; the result is checked before subsequent workspace writes.
6. Follow-up objectives should be submitted with the relevant project selected. VOH retrieves project-scoped architecture, indexed files, dependencies, recent tasks, and decisions rather than sending the whole repository to the model.
7. Expand **Task history** to search/filter previous runs, inspect recorded evidence, or reuse an objective. The details view lists source files recorded for the selected task. **Workspace recovery** compares file paths against a pre-change snapshot and offers restore only after an explicit confirmation; this is a whole-workspace restore, not a line-by-line content diff. The project file index and context cache are refreshed after restore.
8. Choose Developer view to show diagnostic details. A failed task remains persisted and can be retried from the inspector.

Project details include an editable Project memory note for workspace-specific preferences and decisions. It is stored with that project's settings, can be cleared, and is supplied as untrusted context to VOH AI. Credential-like values and private keys are rejected; current repository files remain the source of truth.

A completed task means the recorded scope passed the checks VOH could actually run. It does not mean every requested product adapter exists; the final summary and timeline state what was verified.

Deployments with an existing database must apply `drizzle/0007_mode_aware_tasks.sql` (or run the configured Drizzle migration workflow) before using persisted execution modes and plan approval.

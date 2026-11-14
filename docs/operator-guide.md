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

## Import an existing repository

Open a project and use **Lifecycle control → Import an existing repository**. Public HTTPS repositories on GitHub, GitLab, and Bitbucket can be cloned into an empty project workspace using a shallow, single-branch clone. Git LFS smudge downloads are skipped to avoid fetching large binary payloads automatically. The import is indexed into the project file catalogue so bounded source files can be inspected in the workspace panel. The import boundary rejects non-HTTPS URLs, unapproved hosts, URL credentials, ports, query strings, and fragments. Private repository import and remote push/pull through a connected GitHub identity require an authenticated provider integration and are not implied by public clone support.

Importing into the project root requires an empty workspace. Use a new project for a repository takeover; do not import over existing work. Large files remain in the workspace but are not copied into the bounded editor index.

## Workspace preview security

Workspace previews are served with a restrictive Content Security Policy and a sandboxed browsing context. Script execution is allowed for local project files, while network connections, workers, forms, embedded frames, and external resource loads are blocked. This protects the authenticated Studio session from untrusted imported project code. As a result, previews are currently suited to self-contained browser projects; apps that need external APIs, remote assets, service workers, or live backend connections need a separately hosted isolated preview runtime before those features can be tested end-to-end.

The **Mobile** project type currently creates an installable Progressive Web App starter with a web app manifest and app icon. It is not a native Android APK or iOS IPA build. Native packaging, device simulators, and store submission require dedicated mobile build runners and signing credentials.

## Manual workspace editing

Select an indexed source file in the Workspace panel and choose **Edit**. Save writes through the owner-scoped workspace procedure, validates the relative path and file-size limit, creates a recovery snapshot before changing the file, updates the project file index, and clears cached project context. The editor warns before discarding unsaved changes. Files that exceed the editor index limit are not editable in this panel.

The Workspace panel also reads the on-disk file inventory. Files excluded from the bounded editor index remain visible in a separate **Not indexed** group with their size and a read-only explanation; the panel does not silently hide large or credential-bearing files.
## Export a project

Use **Export ZIP** in the Workspace panel to download the current project source. The export is owner-authenticated, excludes `.git`, `node_modules`, environment files, private-key files, and content matching known credential patterns, and omits individual files larger than 5 MB. Exports are bounded to 500 files and 25 MB uncompressed; a project that exceeds the archive limits must be reduced before export.
## Studio readiness

Open **Advanced details** to view the Studio Readiness panel. It checks platform identity configuration, database connectivity, and coding/reasoning model routes without displaying secret values. It also distinguishes capabilities available in this build from features that still need isolated backend execution, native mobile build runners, or live deployment providers.

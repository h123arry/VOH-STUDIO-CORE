# VOH STUDIO security model

Generated project files are stored in project-specific directories below the configured VOH workspace root. Paths are normalized, traversal is rejected, symlinks are checked on sensitive file operations, and file sizes are bounded. These directories are filesystem organization boundaries, **not operating-system security sandboxes**.

Project command execution is disabled whenever `NODE_ENV=production`. The server will not run generated project code on the production application host. In non-production development environments, the existing allowlisted command runner still uses child processes under the application server's OS identity; this is suitable only for a trusted local development environment and must not be treated as isolation for untrusted multi-tenant projects. Dependency installation remains blocked when a project declares dependencies.

A production execution service must be a separate isolated runtime (dedicated container or VM) with non-root execution, filesystem and process isolation, CPU/memory/time quotas, controlled network egress, ephemeral credentials, and bounded artifact transfer. Build, test, and terminal tools remain unavailable to agents until that runtime is implemented and verified.

Authentication uses the initialized OAuth flow. Project and task queries are owner-scoped. Sensitive project paths and content matching credential patterns are excluded before project memory and relevant-file context are sent to model providers. This is an AI-context filter, not a secrets vault: project files remain stored in the workspace and may be visible to the authenticated project owner. Do not store live credentials in project files. Model calls use server-side platform credentials and never expose them to the browser. The UI displays safe result summaries and does not expose hidden chain-of-thought.

Production deployment and arbitrary package installation remain separate approval-gated capabilities; neither is enabled by this workspace command runner.

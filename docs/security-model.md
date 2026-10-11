# VOH STUDIO security model

Generated work runs inside a project-specific workspace below the configured VOH workspace root. File paths are normalized, traversal is rejected, file sizes are capped, and the model receives tool schemas rather than host access.

Terminal execution is allowlisted to common project commands and runs with a project cwd, bounded timeout, bounded output, and a reduced environment. Destructive commands, secret reads, arbitrary host paths, network utilities, publishing, and production deployment are blocked or approval-gated. Package installation is not silently performed by the first release.

Authentication remains the initialized OAuth flow. Every project and task query is owner-scoped. Model calls use server-side platform credentials at runtime and never expose them to the browser. The UI displays safe result summaries and does not expose hidden chain-of-thought.

The current workspace executor is intentionally narrower than a hardened multi-tenant build farm. A future production executor should use a dedicated container or VM boundary, resource quotas, network policy, artifact storage, and a separate approval service before enabling arbitrary generated-project execution.

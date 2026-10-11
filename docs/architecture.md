# VOH STUDIO architecture

VOH STUDIO is a persistent autonomous development workbench. The web client is a thin studio surface over authenticated tRPC procedures. The server owns project scope, task lifecycle, model routing, workspace tools, and evidence persistence.

## Lifecycle

Every objective is a durable task. The orchestrator records a transition before each side effect, delegates to an agent executor, records tool results, and moves through the bounded phases `PLAN → BUILD → RUN → TEST → INSPECT → DEBUG → PATCH → REBUILD → RETEST`. A task can end in `completed`, `failed`, or `cancelled`; failures retain a classified diagnostic and recovery recommendation.

The first release performs real workspace initialization and evidence capture. If a reasoning model is unavailable, the planner emits a deterministic fallback plan and records that fact as a warning. If a workspace has no package manifest, VOH skips build/test rather than inventing commands.

## Data flow

Projects own workspaces and tasks. Tasks own ordered steps, append-only events, agent runs, tool calls, errors, and verification runs. Small text files are indexed in `project_files`; the on-disk workspace is the source of execution. The client polls an active task until it reaches a terminal state, then stops polling.

## Extension points

Agents, model roles, tools, project types, and deployment providers are registry-driven. Each adapter declares capability, executor status, model role, and safety scope. Adding an adapter does not require rewriting the orchestrator; it implements the shared executor or tool contract and registers its capability.

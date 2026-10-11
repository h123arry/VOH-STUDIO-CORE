# Agents and tools

## Active executors

The orchestrator, architect/planner, frontend workspace writer, QA verifier, debugger/recovery classifier, and documentation writer are active in the first release. They persist concise action summaries and evidence; they do not persist hidden reasoning.

## Registered extension agents

Backend, Database, Mobile, Game Development, AI, UI/UX, DevOps, Security, Research, and Asset agents are registered with explicit capability and safety scopes. Some require a future runtime or an approval-gated adapter. They are not exposed as fake action buttons and do not claim work until an executor is installed.

## Current bounded tools

`workspace.listFiles`, `workspace.readFile`, `workspace.writeFile`, `project.inspect`, `project.build`, `project.test`, and `package.inspect`-style inspection are represented by the workspace tool layer. Every call records tool name, arguments summary, permission scope, status, and duration. Packaging and external deployment are extension points, not implicit behavior.

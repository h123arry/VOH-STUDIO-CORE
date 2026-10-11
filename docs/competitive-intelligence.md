# VOH STUDIO competitive intelligence

## What the research says

The strongest products divide into two groups. **Manus, Lovable, Replit, Bolt, Google AI Studio, and v0** are strong at turning an idea into a visible product with managed infrastructure, previews, integrations, and deployment. **Cursor, Windsurf, Claude Code, and Codex** are stronger software-engineering substrates: repository understanding, terminal execution, debugging, cloud/local work, subagents, skills, hooks, and reviewable changes.

VOH STUDIO should not copy either group. Its advantage is to combine their useful patterns behind one experience: **describe an outcome, receive a working result with evidence, then keep improving it**.

## Research-backed priorities

1. **Make queued work real.** Accept follow-up instructions while a task is running, preserve them durably, and launch them as the next task after completion.
2. **Make quality evidence first-class.** Keep build, test, security, accessibility, performance, reliability, and responsiveness visible beside the result.
3. **Make takeover a core path.** Index an existing project, map dependencies and architecture, detect debt, create a staged plan, and apply incremental changes rather than regenerating the project.
4. **Make visual iteration honest.** Preview and screenshot inspection are useful only when the system can map a referenced element back to owned source files. Until capture and source mapping are integrated, the capability remains experimental.
5. **Make reusable knowledge portable.** Skills should carry instructions, tools, workflows, quality rules, validation, and reusable actions, while custom skills remain permissioned and project-scoped.
6. **Keep computer control bounded.** Terminal and filesystem execution are active inside the isolated workspace. Browser capture and runtime launch are registered capabilities until their executor and approval paths are fully integrated. External sites and applications are never modified without explicit user-controlled access.

## VOH matrix interpretation

VOH is strongest today in autonomous task execution, project memory, security/performance policy, quality scoring, and modular extensibility. It is partially supported in agent swarms, project takeover, background execution, and multimodal intake. Visual development and production deployment remain experimental because the missing pieces are not UI labels; they require reliable screenshot capture, source mapping, external integration contracts, and approval-safe execution.

## Source coverage

The detailed structured dataset is available through the authenticated `intelligence.research` procedure and is stored in `server/intelligence/competitive-research.ts`. It records the reviewed public product documentation and announcements for Manus, Lovable, Google AI Studio, Replit, Bolt, Cursor, Windsurf, v0, Claude Code, and Codex. Product claims are treated as documented capabilities, not independent performance benchmarks.

The implementation intentionally records limits alongside strengths. A capability is not marked supported merely because a competing product mentions it; it is supported only when VOH has a working executor, a visible API or workflow, and validation evidence.

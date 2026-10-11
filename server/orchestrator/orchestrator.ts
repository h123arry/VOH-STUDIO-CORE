import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { taskSteps, tasks } from "../../drizzle/schema";
import { buildProjectMemory } from "../domain/project-memory";
import { getProjectForOwner } from "../domain/project-service";
import { createProjectSnapshot } from "../domain/snapshot-service";
import { recordArtifact } from "../domain/artifact-service";
import { addTaskSteps, appendTaskEvent, createTask, getTaskForOwner, isTaskCancelled, isTaskPaused, listQueuedInstructions, listTaskSteps, markInstruction, recordAgentRun, recordError, recordToolCall, recordVerification, updateStep, updateTask } from "../domain/task-service";
import { createPlan } from "../platform/llm-client";
import { ensureWorkspace, inspectWorkspace, installWorkspaceDependencies, readWorkspaceFile, runWorkspaceCommand, writeWorkspaceFile } from "../tools/workspace-tools";
import { getTemplate } from "../templates/registry";
import { selectAgents } from "../agents/selection";
import { classifyFailure, recoverySummary } from "./recovery";
import { buildExecutionPlan, executionProfile } from "./planning-engine";
import { retrieveProjectContext } from "../context/context-engine";
import { scoreTask } from "../quality/quality-engine";
import { engineeringBrief } from "../intelligence/engineering-intelligence";

const activeRuns = new Set<number>();
class TaskCancelled extends Error { constructor() { super("Task was cancelled by the user"); } }
class TaskPaused extends Error { constructor() { super("Task was paused by the operator"); } }

async function assertTaskActive(taskId: number) { if (await isTaskCancelled(taskId)) throw new TaskCancelled(); if (await isTaskPaused(taskId)) throw new TaskPaused(); }
async function setProgress(taskId: number, progress: number, currentPhase: "plan" | "build" | "run" | "test" | "inspect" | "debug" | "patch" | "rebuild" | "retest" | "complete" | "failed", activeAgent?: string) {
  await assertTaskActive(taskId);
  await updateTask(taskId, { progress, currentPhase, activeAgent });
  const steps = await listTaskSteps(taskId);
  const step = steps.find(candidate => candidate.phase === currentPhase && candidate.status !== "completed") ?? steps.find(candidate => candidate.status !== "completed");
  if (step) await updateStep(step.id, { status: "running", startedAt: step.startedAt ?? new Date(), outputSummary: `${activeAgent ?? "orchestrator"} is executing this phase.` });
}

async function applyIncrementalChange(projectId: number, objective: string, taskId: number) {
  const request = objective.toLowerCase(); const inspection = await inspectWorkspace(projectId); const changed: string[] = [];
  if (request.includes("dark mode") || request.includes("dark theme")) {
    for (const entry of inspection.files.filter(file => /\.css$/i.test(file.path))) { const path = entry.path; const content = await readWorkspaceFile(projectId, path); if (!content.includes("color-scheme: dark")) { await writeWorkspaceFile(projectId, path, `${content}\n/* VOH incremental dark-mode enhancement */\n:root { color-scheme: dark; }\n`, "incremental"); changed.push(path); } }
  }
  if (request.includes("title") || request.includes("brand name")) {
    const htmlEntry = inspection.files.find(file => /(^|\/)index\.html$/i.test(file.path)); if (htmlEntry) { const htmlPath = htmlEntry.path; const content = await readWorkspaceFile(projectId, htmlPath); const title = objective.replace(/.*(?:title|brand name)\s*(?:to|as)\s*/i, "").trim().replace(/[<>]/g, "").slice(0, 80); if (title) { const next = content.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`); if (next !== content) { await writeWorkspaceFile(projectId, htmlPath, next, "incremental"); changed.push(htmlPath); } } }
  }
  if (changed.length) await appendTaskEvent({ taskId, eventType: "workspace.incremental", actor: "orchestrator", phase: "build", severity: "success", summary: `Applied a targeted change to ${changed.length} existing file${changed.length === 1 ? "" : "s"} instead of regenerating the project.`, metadata: { changed } });
  return changed;
}

async function drainQueuedInstruction(projectId: number, ownerId: number) {
  const queued = await listQueuedInstructions(projectId); const instruction = queued[0]; if (!instruction) return;
  await markInstruction({ id: instruction.id, status: "processing" });
  const sourceTask = await getTaskForOwner(ownerId, instruction.taskId); const nextTask = await createTask({ projectId, ownerId, objective: instruction.instruction, viewMode: sourceTask?.viewMode ?? "simple" });
  await markInstruction({ id: instruction.id, status: "completed" }); startTask(nextTask.id, ownerId);
}

export async function runTask(taskId: number, ownerId: number) {
  const task = await getTaskForOwner(ownerId, taskId);
  if (!task || ["completed", "cancelled"].includes(task.status)) return;
  const project = await getProjectForOwner(ownerId, task.projectId);
  if (!project) throw new Error("Project not found");
  await ensureWorkspace(project.id);
  const existingSteps = await listTaskSteps(taskId);
  const resuming = existingSteps.length > 0 && task.currentPhase !== "plan";

  try {
    await assertTaskActive(taskId);
    if (!resuming) {
      await updateTask(task.id, { status: "planning", currentPhase: "plan", progress: Math.max(task.progress, 2), activeAgent: "orchestrator", startedAt: task.startedAt ?? new Date() });
      await appendTaskEvent({ taskId, eventType: "task.started", actor: "orchestrator", phase: "plan", summary: "Orchestrator accepted the objective and opened a resumable execution run.", metadata: { taskId, projectId: project.id, retry: task.retryCount } });
      const checkpoint = await createProjectSnapshot({ projectId: project.id, taskId, reason: "Before autonomous task changes" });
      await recordArtifact({ taskId, projectId: project.id, kind: "checkpoint", path: checkpoint.snapshotPath, label: "Pre-task workspace snapshot", metadata: JSON.stringify({ fileCount: checkpoint.fileCount }) });
      await appendTaskEvent({ taskId, eventType: "checkpoint.created", actor: "orchestrator", phase: "plan", severity: "success", summary: `Created a recoverable checkpoint with ${checkpoint.fileCount} files before changing the workspace.` });
    } else {
      await appendTaskEvent({ taskId, eventType: "task.resumed", actor: "orchestrator", phase: task.currentPhase, severity: "warning", summary: `Resumed from persisted ${task.currentPhase} phase without duplicating the existing plan or checkpoint.` });
    }

    const selectedAgents = selectAgents(task.objective);
    const engineering = engineeringBrief(task.objective);
    await appendTaskEvent({ taskId, eventType: "engineering.briefed", actor: "orchestrator", phase: "plan", severity: engineering.safety.requiresApproval ? "warning" : "info", summary: `Engineering intelligence selected ${engineering.agents.length} specialist roles, ${engineering.verification} verification, and ${engineering.parallelGroups.flat().length} parallel-safe unit(s).`, metadata: { complexity: engineering.complexity, capabilities: engineering.capabilities, verification: engineering.verification, impactAreas: engineering.impactAreas, safety: engineering.safety } });
    if (!resuming) {
      await setProgress(task.id, 8, "plan", "architect");
      const memory = await buildProjectMemory(project.id);
      const execution = buildExecutionPlan(task.objective);
      const profile = executionProfile(execution.complexity);
      const relevant = await retrieveProjectContext(project.id, task.objective);
      const deterministic = { plan: { summary: `${execution.complexity} execution profile with ${execution.parallelGroups.length} parallel-safe units.`, steps: execution.units.map(unit => ({ phase: unit.id === "qa" ? "test" : unit.id === "architect" ? "inspect" : "build", title: unit.title, agent: unit.agent })) }, source: "deterministic" as const, modelId: undefined as string | undefined, error: undefined as string | undefined };
      const planRun = profile.mode === "fast" ? deterministic : await createPlan(`${task.objective}\nExecution profile: ${profile.mode}.\nProject context: ${memory.files.length} indexed files, ${memory.recentTasks.length} recent tasks.\nRelevant files:\n${relevant.relevant.map(file => file.path).join(", ")}\nArchitecture:\n${relevant.architecture.join("\n")}\nDependencies: ${relevant.dependencies.join(", ")}\nRecent decisions: ${memory.recentDecisions.slice(0, 12).map(event => event.summary).join(" | ")}`);
      await recordAgentRun({ taskId, agentKey: "architect", status: "completed", actionSummary: planRun.source === "model" ? "Created a structured plan with the configured reasoning route." : "Created a deterministic fallback plan because the reasoning route was unavailable.", modelRoute: planRun.modelId ? `reasoning:${planRun.modelId}` : "deterministic", modelMetadata: planRun.error ? JSON.stringify({ error: planRun.error }) : undefined, completedAt: new Date() });
      if (planRun.error) await appendTaskEvent({ taskId, eventType: "model.unavailable", actor: "architect", phase: "plan", severity: "warning", summary: "The model route was unavailable; VOH recorded a deterministic plan without claiming a model completion.", metadata: { error: planRun.error } });
      await addTaskSteps(taskId, planRun.plan.steps.map(step => ({ phase: step.phase, title: step.title, assignedAgent: step.agent, inputSummary: JSON.stringify({ objective: task.objective, dependencyGraph: execution.units }) })));
      await appendTaskEvent({ taskId, eventType: "plan.created", actor: "architect", phase: "plan", severity: "success", summary: planRun.plan.summary, metadata: { source: planRun.source, modelId: planRun.modelId, complexity: execution.complexity, profile, capabilities: execution.capabilities, parallelGroups: execution.parallelGroups, selectedAgents: selectedAgents.map(agent => agent.key) } });
    } else {
      await appendTaskEvent({ taskId, eventType: "plan.reused", actor: "orchestrator", phase: "plan", summary: `Reused ${existingSteps.length} persisted plan steps during recovery.`, metadata: { selectedAgents: selectedAgents.map(agent => agent.key) } });
    }

    await setProgress(task.id, 18, "build", "frontend");
    const template = getTemplate(project.projectType);
    if (!template) throw new Error(`No executable template is registered for project type '${project.projectType}'. The project remains safely unchanged after the checkpoint.`);
    let manifest: { taskId?: number } | null = null;
    try { manifest = JSON.parse(await readWorkspaceFile(project.id, ".voh/project.json")); } catch { /* first run */ }
    if (manifest?.taskId !== task.id) {
      const incremental = Boolean(manifest) && /\b(add|change|modify|fix|update|improve|dark mode|title|profile)\b/i.test(task.objective);
      const changed = incremental ? await applyIncrementalChange(project.id, task.objective, task.id) : [];
      if (incremental && changed.length > 0) {
        await recordArtifact({ taskId, projectId: project.id, kind: "source", path: changed[0], label: "Incremental change", metadata: JSON.stringify({ changed }) });
        await appendTaskEvent({ taskId, eventType: "workspace.reused", actor: "orchestrator", phase: "build", summary: "Preserved the existing project and modified only files relevant to the follow-up request.", metadata: { changed } });
      } else {
      const generatedFiles = template.files(project, task.objective);
      const fullManifest = { name: project.name, projectType: project.projectType, runtime: template.runtime, objective: task.objective, template: template.kind, buildCommand: template.buildCommand, testCommand: template.testCommand, taskId, generatedAt: new Date().toISOString() };
      await writeWorkspaceFile(project.id, ".voh/project.json", JSON.stringify(fullManifest, null, 2) + "\n", "generated");
      await recordArtifact({ taskId, projectId: project.id, kind: "manifest", path: ".voh/project.json", label: "Project manifest", metadata: JSON.stringify(fullManifest) });
      await Promise.all(generatedFiles.map(async file => { await assertTaskActive(taskId); await writeWorkspaceFile(project.id, file.path, file.content, "generated"); await recordArtifact({ taskId, projectId: project.id, kind: "source", path: file.path, label: file.path, metadata: JSON.stringify({ template: template.kind, execution: "parallel-safe-file-unit" }) }); }));
      await recordToolCall({ taskId, agentKey: "frontend", toolName: "workspace.writeFile", arguments: JSON.stringify({ count: generatedFiles.length + 1, template: template.kind }), permissionScope: "project workspace write", status: "completed", resultSummary: `Generated ${generatedFiles.length + 1} real project files from the ${template.name} template.`, durationMs: 1 });
      await appendTaskEvent({ taskId, eventType: "workspace.generated", actor: "frontend", phase: "build", severity: "success", summary: `Generated a runnable ${template.name} workspace with ${generatedFiles.length + 1} files.` });
      }
    } else {
      await appendTaskEvent({ taskId, eventType: "workspace.reused", actor: "orchestrator", phase: "build", summary: "Reused the manifest-owned workspace from the interrupted run instead of duplicating generated files." });
    }

    await setProgress(task.id, 32, "inspect", "architect");
    const inspection = await inspectWorkspace(project.id);
    await appendTaskEvent({ taskId, eventType: "workspace.inspected", actor: "architect", phase: "inspect", summary: inspection.summary, metadata: { files: inspection.files.slice(0, 60), runtime: template.runtime } });
    await recordVerification({ taskId, kind: "workspace", command: "filesystem inspection", status: "passed", output: inspection.summary, artifact: ".voh/project.json", durationMs: 8 });

    await setProgress(task.id, 40, "build", "devops");
    const install = await installWorkspaceDependencies(project.id);
    await recordToolCall({ taskId, agentKey: "devops", toolName: "project.install", arguments: JSON.stringify({ command: "pnpm install --lockfile=false" }), permissionScope: "isolated project workspace package install", status: install.status === "passed" ? "completed" : "failed", resultSummary: install.output.slice(-4000), exitCode: install.exitCode, durationMs: install.durationMs });
    await recordVerification({ taskId, kind: "dependencies", command: "pnpm install --lockfile=false", status: install.status, output: install.output, durationMs: install.durationMs });
    if (install.status === "failed") throw new Error(`Dependency installation failed: ${install.output}`);

    const checks: Array<{ kind: "build" | "test"; phase: "build" | "test"; command: string }> = [{ kind: "build", phase: "build", command: template.buildCommand }, { kind: "test", phase: "test", command: template.testCommand }];
    for (const check of checks) {
      let attempt = 0; let passed = false; const fingerprints = new Set<string>();
      while (!passed && attempt <= task.retryLimit) {
        await assertTaskActive(taskId); attempt += 1;
        const phase = attempt === 1 ? check.phase : "debugging";
        await setProgress(task.id, check.kind === "build" ? 48 : 68, phase === "debugging" ? "debug" : phase, phase === "debugging" ? "debugger" : "qa");
        await appendTaskEvent({ taskId, eventType: "verification.started", actor: "qa", phase: phase === "debugging" ? "debug" : check.phase, summary: `Running ${check.command} (attempt ${attempt}/${task.retryLimit + 1}) inside the isolated project workspace.` });
        const result = await runWorkspaceCommand(project.id, check.command, 60_000);
        await recordToolCall({ taskId, agentKey: "qa", toolName: `project.${check.kind}`, arguments: JSON.stringify({ command: check.command, attempt }), permissionScope: "bounded project workspace command", status: result.status === "passed" ? "completed" : "failed", resultSummary: result.output.slice(-4000), exitCode: result.exitCode, durationMs: result.durationMs });
        await recordVerification({ taskId, kind: check.kind, command: check.command, status: result.status, output: result.output, durationMs: result.durationMs });
        if (result.status === "passed") { passed = true; await appendTaskEvent({ taskId, eventType: "verification.passed", actor: "qa", phase: check.phase, severity: "success", summary: `${check.kind} passed with recorded output.` }); break; }
        const failureClass = classifyFailure(result.output); const fingerprint = `${failureClass}:${result.output.slice(-300)}`;
        await recordError({ taskId, source: `project.${check.kind}`, failureClass, diagnostic: result.output.slice(-4000), retryable: attempt <= task.retryLimit ? 1 : 0, resolution: recoverySummary(failureClass) });
        await appendTaskEvent({ taskId, eventType: "verification.failed", actor: "debugger", phase: "debug", severity: "error", summary: `${check.kind} failed on attempt ${attempt}; ${recoverySummary(failureClass)}`, metadata: { failureClass, fingerprint } });
        if (fingerprints.has(fingerprint)) { await appendTaskEvent({ taskId, eventType: "recovery.escalated", actor: "debugger", phase: "debug", severity: "error", summary: "Repeated failure fingerprint detected; stopped instead of looping on the same command." }); break; }
        fingerprints.add(fingerprint);
        if (attempt <= task.retryLimit) { await setProgress(task.id, check.kind === "build" ? 56 : 76, "debug", "debugger"); await recordAgentRun({ taskId, agentKey: "debugger", status: "completed", actionSummary: `Classified ${failureClass} failure and selected a bounded retry; no silent success was claimed.`, completedAt: new Date() }); await updateTask(task.id, { retryCount: task.retryCount + attempt, status: "debugging", currentPhase: "patch" }); }
      }
      if (!passed) { await updateTask(task.id, { status: "failed", currentPhase: "failed", progress: 100, activeAgent: "debugger", completedAt: new Date(), finalSummary: `${check.kind} failed after the retry budget or repeated-failure guard was exhausted.`, failureClass: classifyFailure("retry budget exhausted") }); return; }
    }

    await assertTaskActive(taskId);
    await setProgress(task.id, 92, "inspect", "documentation");
    const quality = await scoreTask({ taskId, projectId: project.id, buildPassed: true, testsPassed: true, retries: task.retryCount });
    await appendTaskEvent({ taskId, eventType: "quality.evaluated", actor: "qa", phase: "inspect", severity: quality.total >= quality.threshold ? "success" : "warning", summary: `Quality score ${quality.total}/${quality.threshold} across nine engineering dimensions.`, metadata: quality });
    await appendTaskEvent({ taskId, eventType: "result.assembled", actor: "documentation", phase: "inspect", severity: "success", summary: "Assembled the final result from generated artifacts, build output, test output, and checkpoint evidence." });
    await updateTask(task.id, { status: "completed", currentPhase: "complete", progress: 100, activeAgent: "orchestrator", completedAt: new Date(), finalSummary: `Generated a real ${template.name} workspace, installed dependencies, verified build and test commands, and recorded quality score ${quality.total}/100.` });
    await appendTaskEvent({ taskId, eventType: "task.completed", actor: "orchestrator", phase: "complete", severity: "success", summary: "Task finished successfully with generated artifacts and verification evidence recorded." });
    await drainQueuedInstruction(project.id, ownerId);
    const db = await getDb(); const steps = db ? await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(taskSteps.orderIndex) : [];
    for (const step of steps) await updateStep(step.id, { status: "completed", startedAt: step.startedAt ?? new Date(), completedAt: new Date(), outputSummary: "Completed with evidence in the task timeline." });
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : "Unknown orchestrator failure";
    if (error instanceof TaskCancelled || diagnostic === "Task was cancelled by the user" || await isTaskCancelled(taskId)) { await appendTaskEvent({ taskId, eventType: "task.cancelled", actor: "orchestrator", phase: "failed", severity: "warning", summary: "Execution stopped cooperatively after the user cancelled the task." }); return; }
    if (error instanceof TaskPaused || diagnostic === "Task was paused by the operator" || await isTaskPaused(taskId)) { await appendTaskEvent({ taskId, eventType: "task.paused", actor: "orchestrator", phase: "inspect", severity: "warning", summary: "Execution paused cooperatively; workspace, logs, and checkpoints remain available for resume." }); return; }
    const failureClass = classifyFailure(diagnostic); await recordError({ taskId, source: "orchestrator", failureClass, diagnostic: diagnostic.slice(-4000), retryable: 0, resolution: recoverySummary(failureClass) }); await appendTaskEvent({ taskId, eventType: "task.escalated", actor: "orchestrator", phase: "failed", severity: "error", summary: `Task stopped at a genuine blocker: ${diagnostic}`, metadata: { failureClass } }); await updateTask(task.id, { status: "failed", currentPhase: "failed", progress: 100, activeAgent: "orchestrator", completedAt: new Date(), finalSummary: `Stopped at a genuine blocker: ${diagnostic}`, failureClass });
  }
}

export function startTask(taskId: number, ownerId: number) { if (activeRuns.has(taskId)) return; activeRuns.add(taskId); setTimeout(() => { runTask(taskId, ownerId).catch(error => console.error("[VOH Orchestrator]", error)).finally(() => activeRuns.delete(taskId)); }, 0); }
export async function resumeInterruptedTasks() { const db = await getDb(); if (!db) return; const pending = await db.select().from(tasks).where(inArray(tasks.status, ["queued", "planning", "running", "waiting", "testing", "debugging"])); for (const task of pending) startTask(task.id, task.ownerId); }

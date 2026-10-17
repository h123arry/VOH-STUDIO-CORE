import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { AGENT_REGISTRY } from "./agents/registry";
import { createProject, getProjectForOwner, listProjectFiles, listProjects, updateProjectSettings, updateProjectTask } from "./domain/project-service";
import { buildProjectMemory, containsSensitiveValue } from "./domain/project-memory";
import { compareProjectSnapshot, listProjectSnapshots, restoreProjectSnapshot } from "./domain/snapshot-service";
import { listArtifacts } from "./domain/artifact-service";
import { appendTaskEvent, approveTaskPlan, createTask, getTaskForOwner, listAgentRuns, listErrors, listQueuedInstructions, listTaskEvents, listTaskSteps, listTasks, listToolCalls, listVerifications, markInstruction, queueTaskInstruction, updateTask } from "./domain/task-service";
import { cancelTaskExecution, startTask } from "./orchestrator/orchestrator";
import { modelRoutes } from "./models/model-router";
import { inspectWorkspace, readWorkspaceFile, listWorkspaceFiles } from "./tools/workspace-tools";
import { TOOL_REGISTRY, toolsForAgent } from "./tools/registry";
import { listTemplates } from "./templates/registry";
import { latestQualityScore } from "./quality/quality-engine";
import { retrieveProjectContext } from "./context/context-engine";
import { CAPABILITY_REGISTRY } from "./capabilities/registry";
import { runPlanningBenchmarks } from "./benchmark/benchmarks";
import { SKILL_REGISTRY, skillsForObjective } from "./skills/registry";
import { CAPABILITY_MATRIX, capabilitySummary } from "./intelligence/competitive-matrix";
import { COMPETITIVE_RESEARCH, researchSourceCount } from "./intelligence/competitive-research";
import { takeoverPlan, validateProjectInputs } from "./intelligence/input-analysis";
import { visualChangePlan } from "./intelligence/visual-loop";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { projects } from "../drizzle/schema";
import { executionModePolicy } from "./domain/execution-mode";
import { gitStatus, gitInit, gitHistory, gitDiff, gitCreateBranch, gitSwitchBranch, gitMerge, gitRestore, gitRevert, gitTag, gitFetch, gitPull, gitPush, gitCommit, cloneRepository, inspectCommitSafety, draftReleaseNotes } from "./lifecycle/git-service";
import { githubAvailability, githubOperation } from "./lifecycle/github-adapter";
import { mapRepository, reviewRepository } from "./lifecycle/repository-intelligence";
import { deploymentPlan, preflightDeployment, projectHealth, DEPLOYMENT_PROVIDERS, ENVIRONMENTS } from "./lifecycle/deployment-engine";
import { createIssue, listIssues, updateIssue, createRelease, listReleases, createDeployment, listDeployments, lifecycleTimeline } from "./lifecycle/lifecycle-service";
import { analyzeProduct, inferProductBlueprint, inspectProductText } from "./intelligence/product-intelligence";
import { engineeringAnalysis, engineeringBrief, maintenancePlan } from "./intelligence/engineering-intelligence";
import { buildCreationPlan, capabilityCatalog, crossProjectReuse, explainCreationResult, inferCreationMode, matchCapabilities } from "./intelligence/creation-engine";

const projectType = z.enum(["website", "web_app", "api", "backend", "mobile", "game", "ai_app", "automation", "dashboard", "saas"]);
const projectSettings = z.object({
  developerMode: z.boolean().optional(),
  commandPolicy: z.literal("safe").optional(),
  projectMemory: z.string().max(4000).optional().refine(value => !value || !containsSensitiveValue(value), "Project memory cannot contain credentials or private keys"),
}).strict();
const defaultProjectSettings: z.infer<typeof projectSettings> = {
  developerMode: false,
  commandPolicy: "safe",
  projectMemory: "",
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.id)),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const project = await getProjectForOwner(ctx.user.id, input.projectId);
      if (!project) return null;
      return { project, tasks: await listTasks(ctx.user.id, input.projectId), files: await listProjectFiles(input.projectId), snapshots: await listProjectSnapshots(input.projectId), memory: await buildProjectMemory(input.projectId) };
    }),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(120), description: z.string().min(2).max(4000), projectType })).mutation(async ({ ctx, input }) => createProject(ctx.user.id, input)),
    archive: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database is not available");
      await db.update(projects).set({ lifecycle: "archived" }).where(and(eq(projects.id, input.projectId), eq(projects.ownerId, ctx.user.id)));
      return { success: true };
    }),
    settings: router({
      get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const project = await getProjectForOwner(ctx.user.id, input.projectId);
        if (!project?.settings) return defaultProjectSettings;
        try { return projectSettings.parse(JSON.parse(project.settings)); } catch { return defaultProjectSettings; }
      }),
      update: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), settings: projectSettings })).mutation(async ({ ctx, input }) => {
        await updateProjectSettings(input.projectId, ctx.user.id, input.settings);
        return input.settings;
      }),
    }),
    snapshots: router({
      compare: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), snapshotId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return compareProjectSnapshot(input.projectId, input.snapshotId); }),
      restore: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), snapshotId: z.number().int().positive(), confirm: z.literal(true) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return restoreProjectSnapshot(input.projectId, input.snapshotId); }),
    }),
  }),

  workspace: router({
    tree: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const project = await getProjectForOwner(ctx.user.id, input.projectId);
      if (!project) throw new Error("Project not found");
      return { indexed: await listProjectFiles(input.projectId), disk: await listWorkspaceFiles(input.projectId) };
    }),
    readFile: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), path: z.string().min(1) })).query(async ({ ctx, input }) => {
      const project = await getProjectForOwner(ctx.user.id, input.projectId);
      if (!project) throw new Error("Project not found");
      return { path: input.path, content: await readWorkspaceFile(input.projectId, input.path) };
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => listTasks(ctx.user.id, input.projectId)),
    get: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const task = await getTaskForOwner(ctx.user.id, input.taskId);
      if (!task) return null;
      const [steps, events, agents, toolCalls, errors, verifications, artifacts, quality] = await Promise.all([listTaskSteps(task.id), listTaskEvents(task.id), listAgentRuns(task.id), listToolCalls(task.id), listErrors(task.id), listVerifications(task.id), listArtifacts(task.id), latestQualityScore(task.projectId, task.id)]);
      return { task, steps, events, agents, toolCalls, errors, verifications, artifacts, quality };
    }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive().optional(), projectName: z.string().min(2).max(120).optional(), description: z.string().max(4000).optional(), projectType: projectType.default("web_app"), objective: z.string().min(1).max(8000), viewMode: z.enum(["simple", "developer"]).default("simple"), executionMode: z.enum(["chat", "plan", "build", "build_more"]).default("build") })).mutation(async ({ ctx, input }) => {
      const modePolicy = executionModePolicy(input.executionMode);
      if (modePolicy.requiresProject && !input.projectId) throw new Error(`${input.executionMode === "build_more" ? "Build More" : input.executionMode === "plan" ? "Plan" : "Chat"} requires an existing project workspace.`);
      const project = input.projectId ? await getProjectForOwner(ctx.user.id, input.projectId) : await createProject(ctx.user.id, { name: input.projectName ?? "Untitled workspace", description: input.description ?? input.objective, projectType: input.projectType });
      if (!project) throw new Error("Project not found");
      if (modePolicy.requiresImplementation) {
        const inventory = await inspectWorkspace(project.id);
        if (!inventory.files.some(file => file.kind === "file" && !file.path.startsWith(".voh/"))) throw new Error("Build More requires an existing implementation. Start a Build first, then extend it.");
      }
      const task = await createTask({ projectId: project.id, ownerId: ctx.user.id, objective: input.objective, viewMode: input.viewMode, executionMode: input.executionMode });
      await updateProjectTask(project.id, ctx.user.id, task.id);
      startTask(task.id, ctx.user.id);
      return { project, task };
    }),
    approvePlan: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), approvedPlan: z.string().min(1).max(12000) })).mutation(async ({ ctx, input }) => {
      const task = await getTaskForOwner(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      if (task.executionMode !== "plan" || task.status !== "waiting" || !task.planContent) throw new Error("This task has no plan waiting for approval");
      const approved = await approveTaskPlan({ taskId: task.id, ownerId: ctx.user.id, approvedPlan: input.approvedPlan.trim() });
      if (!approved) throw new Error("This plan was already approved or is no longer waiting. Refresh the task before trying again.");
      await appendTaskEvent({ taskId: task.id, eventType: "approval.granted", actor: "operator", phase: "plan", severity: "success", summary: "The user approved the current plan; the approved version was passed to the build engine." });
      startTask(task.id, ctx.user.id);
      return { success: true };
    }),
    cancel: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getTaskForOwner(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      if (["completed", "failed", "cancelled"].includes(task.status)) throw new Error("Only a nonterminal task can be cancelled");
      await updateTask(task.id, { status: "cancelled", currentPhase: "failed", completedAt: new Date(), finalSummary: "Cancelled by the operator before completion." });
      cancelTaskExecution(task.id);
      await appendTaskEvent({ taskId: task.id, eventType: "task.cancelled", actor: "operator", phase: task.currentPhase, severity: "warning", summary: "Cancellation requested; active workspace commands receive a termination signal where supported." });
      return { success: true };
    }),
    retry: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const task = await getTaskForOwner(ctx.user.id, input.taskId);
      if (!task) throw new Error("Task not found");
      await updateTask(task.id, { status: "queued", currentPhase: "plan", retryCount: task.retryCount + 1, completedAt: null, finalSummary: null, failureClass: null });
      await updateProjectTask(task.projectId, ctx.user.id, task.id);
      startTask(task.id, ctx.user.id);
      return { success: true };
    }),
    pause: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); if (!["queued", "planning", "running", "waiting", "testing", "debugging"].includes(task.status)) throw new Error("Only an active task can be paused"); await updateTask(task.id, { status: "paused", finalSummary: "Paused by the operator; workspace and checkpoint remain available." }); return { success: true }; }),
    resume: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); if (task.status !== "paused") throw new Error("Task is not paused"); await updateTask(task.id, { status: "queued", finalSummary: null }); startTask(task.id, ctx.user.id); return { success: true }; }),
    queueInstruction: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), instruction: z.string().min(4).max(4000) })).mutation(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); if (["completed", "failed", "cancelled"].includes(task.status)) throw new Error("Instructions can only be queued while a task is active"); const queued = await queueTaskInstruction({ projectId: task.projectId, taskId: task.id, ownerId: ctx.user.id, instruction: input.instruction }); await appendTaskEvent({ taskId: task.id, eventType: "instruction.queued", actor: "operator", phase: task.currentPhase, severity: "info", summary: "Queued a follow-up instruction without interrupting the active run.", metadata: { instructionId: queued.id } }); return queued; }),
    cancelInstruction: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), instructionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); const instruction = (await listQueuedInstructions(task.projectId, task.id)).find(item => item.id === input.instructionId); if (!instruction) throw new Error("Queued instruction not found"); await markInstruction({ id: instruction.id, status: "cancelled" }); await appendTaskEvent({ taskId: task.id, eventType: "instruction.cancelled", actor: "operator", phase: task.currentPhase, severity: "info", summary: "Removed a queued follow-up before it started.", metadata: { instructionId: instruction.id } }); return { success: true }; }),
    queuedInstructions: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), taskId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return listQueuedInstructions(input.projectId, input.taskId); }),
    events: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); return listTaskEvents(input.taskId); }),
    steps: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); return listTaskSteps(input.taskId); }),
    agents: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); return listAgentRuns(input.taskId); }),
    toolCalls: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); return listToolCalls(input.taskId); }),
    verifications: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => { const task = await getTaskForOwner(ctx.user.id, input.taskId); if (!task) throw new Error("Task not found"); return listVerifications(input.taskId); }),
  }),

  agents: router({ registry: protectedProcedure.query(() => AGENT_REGISTRY) }),
  models: router({ routes: protectedProcedure.query(() => modelRoutes()) }),
  tools: router({
    registry: protectedProcedure.query(() => TOOL_REGISTRY.map(tool => ({ ...tool, schema: tool.schema.description ?? "validated input" }))),
    forAgent: protectedProcedure.input(z.object({ agentKey: z.string() })).query(({ input }) => toolsForAgent(input.agentKey).map(tool => ({ ...tool, schema: tool.schema.description ?? "validated input" }))),
  }),
  context: router({
    retrieve: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), query: z.string().min(1).max(1000), limit: z.number().int().min(1).max(30).default(12) })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return retrieveProjectContext(input.projectId, input.query, input.limit); }),
  }),
  capabilities: router({ list: protectedProcedure.query(() => CAPABILITY_REGISTRY) }),
  benchmarks: router({ planning: protectedProcedure.query(() => runPlanningBenchmarks()) }),
  skills: router({ list: protectedProcedure.query(() => SKILL_REGISTRY), recommend: protectedProcedure.input(z.object({ objective: z.string().min(1).max(8000) })).query(({ input }) => skillsForObjective(input.objective)) }),
  intelligence: router({ matrix: protectedProcedure.query(() => CAPABILITY_MATRIX), summary: protectedProcedure.query(() => capabilitySummary()), research: protectedProcedure.query(() => ({ competitors: COMPETITIVE_RESEARCH, sourceCount: researchSourceCount() })) }),
  inputs: router({ validate: protectedProcedure.input(z.object({ inputs: z.array(z.object({ kind: z.enum(["text", "image", "screenshot", "diagram", "pdf", "website", "application", "codebase"]), name: z.string(), source: z.string(), permissionConfirmed: z.boolean(), notes: z.string().optional() })).max(20) })).mutation(({ input }) => validateProjectInputs(input.inputs)), takeover: protectedProcedure.input(z.object({ files: z.array(z.object({ path: z.string(), size: z.number().int().nonnegative(), content: z.string().max(100000).optional() })).max(5000) })).mutation(({ input }) => takeoverPlan(input.files)) }),
  visual: router({ planChange: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), previewPath: z.string(), elementHint: z.string().min(1).max(500), instruction: z.string().min(1).max(2000), screenshotPath: z.string().optional() })).mutation(({ input }) => visualChangePlan(input)) }),
  templates: router({ list: protectedProcedure.query(() => listTemplates()) }),
  product: router({
    blueprint: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), objective: z.string().min(8).max(8000).optional(), projectType: z.string().max(64).default("web_app") })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return inferProductBlueprint(input.objective ?? "Build a coherent product from this project", input.projectType); }),
    analyze: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), objective: z.string().min(8).max(8000).optional() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return analyzeProduct(input.projectId, input.objective); }),
    inspect: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), query: z.string().min(2).max(200) })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return inspectProductText(input.projectId, input.query); }),
  }),
  engineering: router({
    brief: protectedProcedure.input(z.object({ objective: z.string().min(3).max(8000) })).query(({ input }) => engineeringBrief(input.objective)),
    maintenance: protectedProcedure.input(z.object({ objective: z.string().min(3).max(8000) })).query(({ input }) => maintenancePlan(input.objective)),
    analyze: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), objective: z.string().min(3).max(8000) })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return engineeringAnalysis(input.projectId, input.objective); }),
  }),
  creation: router({
    mode: protectedProcedure.input(z.object({ objective: z.string().min(3).max(8000) })).query(({ input }) => ({ mode: inferCreationMode(input.objective), capabilities: matchCapabilities(input.objective) })),
    plan: protectedProcedure.input(z.object({ objective: z.string().min(3).max(8000), inputs: z.array(z.object({ kind: z.enum(["text", "image", "screenshot", "diagram", "pdf", "website", "application", "codebase"]), name: z.string(), source: z.string(), permissionConfirmed: z.boolean(), notes: z.string().optional() })).max(20).default([]) })).query(({ input }) => buildCreationPlan(input.objective, input.inputs)),
    catalog: protectedProcedure.query(() => capabilityCatalog()),
    explain: protectedProcedure.input(z.object({ changes: z.array(z.string()).max(100), evidence: z.array(z.string()).max(100), remaining: z.array(z.string()).max(100).default([]) })).query(({ input }) => explainCreationResult(input.changes, input.evidence, input.remaining)),
    reuse: protectedProcedure.input(z.object({ sourceProjectId: z.number().int().positive(), sourceName: z.string().min(1).max(180), sourceFiles: z.array(z.string()).max(1000), targetProjectId: z.number().int().positive(), targetName: z.string().min(1).max(180), pattern: z.string().min(2).max(500) })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.sourceProjectId) || !await getProjectForOwner(ctx.user.id, input.targetProjectId)) throw new Error("Project not found"); return crossProjectReuse({ projectId: input.sourceProjectId, name: input.sourceName, files: input.sourceFiles }, { projectId: input.targetProjectId, name: input.targetName }, input.pattern); }),
  }),
  lifecycle: router({
    git: router({
      status: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitStatus(input.projectId); }),
      init: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitInit(input.projectId); }),
      history: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(20) })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitHistory(input.projectId, input.limit); }),
      diff: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), ref: z.string().optional() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitDiff(input.projectId, input.ref); }),
      safety: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return inspectCommitSafety(input.projectId); }),
      commit: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), message: z.string().min(1).max(180) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitCommit(input.projectId, input.message); }),
      branch: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().min(1).max(160) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitCreateBranch(input.projectId, input.name); }),
      switch: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().min(1).max(160) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitSwitchBranch(input.projectId, input.name); }),
      merge: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().min(1).max(160) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitMerge(input.projectId, input.name); }),
      restore: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), path: z.string().optional() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitRestore(input.projectId, input.path); }),
      revert: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), sha: z.string().min(7).max(64) })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitRevert(input.projectId, input.sha); }),
      tag: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().min(1).max(160), sha: z.string().optional() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitTag(input.projectId, input.name, input.sha); }),
      fetch: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitFetch(input.projectId); }),
      pull: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitPull(input.projectId); }),
      push: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), remote: z.string().default("origin"), branch: z.string().optional() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return gitPush(input.projectId, input.remote, input.branch); }),
      clone: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), url: z.string().min(8).max(500), destination: z.string().default("imported") })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return cloneRepository(input.projectId, input.url, input.destination); }),
    }),
    github: router({ status: protectedProcedure.query(() => githubAvailability()), operation: protectedProcedure.input(z.object({ operation: z.string().min(2).max(100) })).mutation(({ input }) => githubOperation(input.operation)) }),
    repository: router({ map: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return mapRepository(input.projectId); }), review: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return reviewRepository(input.projectId); }) }),
    deployment: router({ providers: protectedProcedure.query(() => DEPLOYMENT_PROVIDERS), plan: protectedProcedure.input(z.object({ provider: z.enum(["static", "frontend", "server", "container", "cloud"]), environment: z.enum(ENVIRONMENTS), branch: z.string().min(1).max(160), domain: z.string().max(255).optional(), project: z.string().max(255).optional() })).query(({ input }) => deploymentPlan(input)), preflight: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), provider: z.enum(["static", "frontend", "server", "container", "cloud"]), environment: z.enum(ENVIRONMENTS), branch: z.string().min(1).max(160), domain: z.string().max(255).optional(), project: z.string().max(255).optional() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return preflightDeployment(input.projectId, input); }), health: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return projectHealth(input.projectId); }) }),
    issues: router({ list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => listIssues(ctx.user.id, input.projectId)), create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), kind: z.enum(["bug", "feature", "improvement", "technical_debt", "task"]), title: z.string().min(2).max(180), description: z.string().min(2).max(10000), priority: z.enum(["low", "medium", "high", "critical"]).default("medium") })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return createIssue({ ...input, ownerId: ctx.user.id, status: "open" }); }), update: protectedProcedure.input(z.object({ issueId: z.number().int().positive(), status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(), priority: z.enum(["low", "medium", "high", "critical"]).optional(), title: z.string().min(2).max(180).optional(), description: z.string().min(2).max(10000).optional() })).mutation(({ ctx, input }) => { const { issueId, ...values } = input; return updateIssue(ctx.user.id, issueId, values); }), startTask: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), issueId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const project = await getProjectForOwner(ctx.user.id, input.projectId); if (!project) throw new Error("Project not found"); const issue = (await listIssues(ctx.user.id, input.projectId)).find(item => item.id === input.issueId); if (!issue) throw new Error("Issue not found"); const task = await createTask({ projectId: project.id, ownerId: ctx.user.id, objective: `${issue.title}: ${issue.description}`, viewMode: "developer" }); await updateProjectTask(project.id, ctx.user.id, task.id); await updateIssue(ctx.user.id, issue.id, { status: "in_progress" }); startTask(task.id, ctx.user.id); return { issue, task }; }) }),
    releases: router({ list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => listReleases(ctx.user.id, input.projectId)), draft: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return draftReleaseNotes(input.projectId); }), create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), version: z.string().min(1).max(64), notes: z.string().min(2).max(20000), commitSha: z.string().max(64).optional(), testSummary: z.string().max(4000).optional(), deploymentSummary: z.string().max(4000).optional() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return createRelease({ ...input, ownerId: ctx.user.id }); }) }),
    deployments: router({ list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => listDeployments(ctx.user.id, input.projectId)), record: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), provider: z.string().max(64), environment: z.enum(ENVIRONMENTS), branch: z.string().max(160), status: z.enum(["planned", "blocked", "running", "succeeded", "failed"]).default("planned"), preflight: z.string().max(20000).optional(), externalId: z.string().max(255).optional() })).mutation(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return createDeployment({ ...input, ownerId: ctx.user.id }); }) }),
    timeline: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => { if (!await getProjectForOwner(ctx.user.id, input.projectId)) throw new Error("Project not found"); return lifecycleTimeline(ctx.user.id, input.projectId); }),
  }),
});

export type AppRouter = typeof appRouter;

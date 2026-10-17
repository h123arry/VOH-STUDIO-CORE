import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  task: null as Record<string, unknown> | null,
  project: {
    id: 7,
    name: "Existing workspace",
    projectType: "website",
    description: "A project under test",
  },
  getTaskForOwner: vi.fn(),
  getProjectForOwner: vi.fn(),
  listTaskSteps: vi.fn(),
  updateTask: vi.fn(),
  appendTaskEvent: vi.fn(),
  recordError: vi.fn(),
  recordArtifact: vi.fn(),
  addTaskSteps: vi.fn(),
  recordAgentRun: vi.fn(),
  isTaskCancelled: vi.fn(),
  isTaskPaused: vi.fn(),
  buildProjectMemory: vi.fn(),
  retrieveProjectContext: vi.fn(),
  inspectWorkspace: vi.fn(),
  ensureWorkspace: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  readWorkspaceFile: vi.fn(),
  runWorkspaceCommand: vi.fn(),
  createProjectSnapshot: vi.fn(),
  createChatResponse: vi.fn(),
  createPlan: vi.fn(),
  createProjectFiles: vi.fn(),
}));

vi.mock("../domain/task-service", () => ({
  getTaskForOwner: mocks.getTaskForOwner,
  listTaskSteps: mocks.listTaskSteps,
  updateTask: mocks.updateTask,
  appendTaskEvent: mocks.appendTaskEvent,
  addTaskSteps: mocks.addTaskSteps,
  recordAgentRun: mocks.recordAgentRun,
  recordError: mocks.recordError,
  isTaskCancelled: mocks.isTaskCancelled,
  isTaskPaused: mocks.isTaskPaused,
}));
vi.mock("../domain/project-service", () => ({
  getProjectForOwner: mocks.getProjectForOwner,
}));
vi.mock("../domain/project-memory", () => ({
  buildProjectMemory: mocks.buildProjectMemory,
}));
vi.mock("../context/context-engine", () => ({
  retrieveProjectContext: mocks.retrieveProjectContext,
}));
vi.mock("../tools/workspace-tools", () => ({
  ensureWorkspace: mocks.ensureWorkspace,
  inspectWorkspace: mocks.inspectWorkspace,
  installWorkspaceDependencies: vi.fn(),
  readWorkspaceFile: mocks.readWorkspaceFile,
  runWorkspaceCommand: mocks.runWorkspaceCommand,
  writeWorkspaceFile: mocks.writeWorkspaceFile,
}));
vi.mock("../domain/snapshot-service", () => ({
  createProjectSnapshot: mocks.createProjectSnapshot,
}));
vi.mock("../domain/artifact-service", () => ({
  recordArtifact: mocks.recordArtifact,
}));
vi.mock("../platform/llm-client", () => ({
  createChatResponse: mocks.createChatResponse,
  createPlan: mocks.createPlan,
  createProjectFiles: mocks.createProjectFiles,
}));

import { runTask } from "./orchestrator";

describe("mode-aware orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.task = {
      id: 11,
      projectId: 7,
      ownerId: 9,
      objective: "Explain the project structure",
      executionMode: "chat",
      approvedPlan: null,
      planContent: null,
      status: "queued",
      currentPhase: "plan",
      progress: 0,
      retryCount: 0,
      retryLimit: 1,
      viewMode: "simple",
    };
    mocks.getTaskForOwner.mockImplementation(async () => mocks.task);
    mocks.getProjectForOwner.mockImplementation(async () => mocks.project);
    mocks.listTaskSteps.mockResolvedValue([]);
    mocks.updateTask.mockResolvedValue(undefined);
    mocks.appendTaskEvent.mockResolvedValue(undefined);
    mocks.recordError.mockResolvedValue(undefined);
    mocks.recordArtifact.mockResolvedValue(undefined);
    mocks.addTaskSteps.mockResolvedValue(undefined);
    mocks.recordAgentRun.mockResolvedValue(undefined);
    mocks.isTaskCancelled.mockResolvedValue(false);
    mocks.isTaskPaused.mockResolvedValue(false);
    mocks.buildProjectMemory.mockResolvedValue({
      project: mocks.project,
      files: [],
      recentTasks: [],
      recentDecisions: [],
      architecture: "No architecture note",
      dependencyManifest: "No package manifest",
      savedContext: "Preserve the current architecture.",
    });
    mocks.retrieveProjectContext.mockResolvedValue({
      relevant: [],
      dependencies: [],
      architecture: [],
    });
    mocks.inspectWorkspace.mockResolvedValue({
      files: [],
      summary: "0 files indexed",
    });
    mocks.readWorkspaceFile.mockRejectedValue(new Error("File not found"));
    mocks.createChatResponse.mockResolvedValue({
      answer: "This project is a website.",
    });
    mocks.createProjectFiles.mockRejectedValue(
      new Error("Stop after checkpoint test")
    );
    mocks.createPlan.mockResolvedValue({
      source: "model",
      modelId: "test-model",
      plan: {
        summary: "Inspect, implement, and verify.",
        steps: [
          {
            phase: "inspect",
            title: "Inspect the workspace",
            agent: "architect",
          },
          { phase: "build", title: "Implement the change", agent: "frontend" },
          { phase: "test", title: "Run verification", agent: "qa" },
        ],
      },
    });
    mocks.createProjectSnapshot.mockResolvedValue({
      snapshotPath: ".voh/snapshots/before-task",
      fileCount: 0,
    });
  });

  it("keeps Chat read-only and persists the actual answer", async () => {
    await runTask(11, 9);

    expect(mocks.createChatResponse).toHaveBeenCalledOnce();
    expect(mocks.writeWorkspaceFile).not.toHaveBeenCalled();
    expect(mocks.runWorkspaceCommand).not.toHaveBeenCalled();
    expect(mocks.createProjectSnapshot).not.toHaveBeenCalled();
    expect(mocks.createChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        projectContext: expect.stringContaining("Preserve the current architecture."),
      })
    );
    expect(mocks.updateTask).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        status: "completed",
        finalSummary: "This project is a website.",
      })
    );
  });

  it("persists a plan and waits for approval without executing modifications", async () => {
    mocks.task = { ...mocks.task, executionMode: "plan" };

    await runTask(11, 9);

    expect(mocks.createPlan).toHaveBeenCalledOnce();
    expect(mocks.writeWorkspaceFile).not.toHaveBeenCalled();
    expect(mocks.runWorkspaceCommand).not.toHaveBeenCalled();
    expect(mocks.createProjectSnapshot).not.toHaveBeenCalled();
    expect(mocks.updateTask).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        status: "waiting",
        planContent: expect.stringContaining("## Verification"),
      })
    );
    expect(mocks.appendTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "approval.requested" })
    );
  });

  it("creates a fresh recovery point after an approved plan before source generation", async () => {
    mocks.task = {
      ...mocks.task,
      executionMode: "plan",
      approvedPlan: "User-approved implementation plan",
      planContent: "Original editable plan",
    };

    await runTask(11, 9);

    expect(mocks.createProjectSnapshot).toHaveBeenCalledWith({
      projectId: 7,
      taskId: 11,
      reason: "Before autonomous task changes",
    });
    expect(mocks.createProjectFiles).toHaveBeenCalledOnce();
    expect(mocks.createProjectFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        projectMemory: "Preserve the current architecture.",
      })
    );
    expect(mocks.writeWorkspaceFile).not.toHaveBeenCalled();
  });
});

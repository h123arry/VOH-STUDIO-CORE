import {
  ArrowUp,
  ChevronDown,
  LoaderCircle,
  Paperclip,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ExecutionMode, Project, TemplateKind } from "@/lib/studio-types";
import CreationPlanPreview from "@/components/studio/CreationPlanPreview";
import TaskRunControls from "@/components/studio/TaskRunControls";
import TaskHistoryPanel from "@/components/studio/TaskHistoryPanel";
import {
  buildAttachmentContext,
  isSupportedContextFile,
  MAX_ATTACHMENT_COUNT,
  MAX_FILE_BYTES,
  MAX_OBJECTIVE_LENGTH,
  MAX_OBJECTIVE_WITH_FILES,
} from "@/lib/task-context";
import { trpc } from "@/lib/trpc";

const creationSuggestions = [
  "Build a web app",
  "Create a website",
  "Create a game",
  "Create an API",
  "Build an automation",
  "Create a dashboard",
];

export default function TaskComposer({
  project,
  onSubmit,
  onCreateProject,
  pending,
  submissionError,
  selectedTaskId,
  onSelectTask,
}: {
  project?: Project;
  onSubmit: (
    objective: string,
    viewMode: "simple" | "developer",
    templateKind: TemplateKind,
    executionMode: ExecutionMode
  ) => void;
  onCreateProject: () => void;
  pending: boolean;
  submissionError?: string;
  selectedTaskId?: number;
  onSelectTask: (taskId: number) => void;
}) {
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<"simple" | "developer">("simple");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => {
    const saved = window.localStorage.getItem("voh.execution-mode");
    return ["chat", "plan", "build", "build_more"].includes(saved ?? "")
      ? (saved as ExecutionMode)
      : "build";
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [templateKind, setTemplateKind] = useState<TemplateKind>("web_app");
  const [watchForNewTasks, setWatchForNewTasks] = useState(false);
  const [readingAttachments, setReadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [approvedPlanText, setApprovedPlanText] = useState("");
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const submissionLock = useRef(false);
  const [dismissedSuggestionTask, setDismissedSuggestionTask] = useState<
    number | null
  >(null);
  useEffect(() => {
    if (!watchForNewTasks) return;
    const timer = window.setTimeout(() => setWatchForNewTasks(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [watchForNewTasks]);
  const projectTasks = trpc.tasks.list.useQuery(
    { projectId: project?.id ?? 0 },
    {
      enabled: Boolean(project),
      refetchInterval: query => {
        const tasks = query.state.data ?? [];
        const latest = tasks[0];
        const active = tasks.some(
          task =>
            ["queued", "planning", "running", "testing", "debugging"].includes(
              task.status
            ) ||
            (task.status === "waiting" &&
              !(task.executionMode === "plan" && !task.approvedPlan))
        );
        const recentlyUpdated =
          latest && Date.now() - new Date(latest.updatedAt).getTime() < 10_000;
        return active || recentlyUpdated || watchForNewTasks ? 3000 : false;
      },
      refetchOnWindowFocus: false,
    }
  );
  const activeTaskId = projectTasks.data?.[0]?.id ?? project?.activeTaskId;
  const activeTask = trpc.tasks.get.useQuery(
    { taskId: activeTaskId ?? 0 },
    {
      enabled: Boolean(activeTaskId),
      refetchInterval: query => {
        const task = query.state.data?.task;
        if (
          task?.status === "waiting" &&
          task.executionMode === "plan" &&
          !task.approvedPlan
        )
          return false;
        return [
          "queued",
          "planning",
          "running",
          "waiting",
          "testing",
          "debugging",
        ].includes(task?.status ?? "")
          ? 3000
          : false;
      },
      refetchOnWindowFocus: false,
    }
  );
  const utils = trpc.useUtils();
  const approvePlan = trpc.tasks.approvePlan.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tasks.get.invalidate(),
        utils.tasks.list.invalidate({ projectId: project?.id ?? 0 }),
      ]);
    },
  });
  useEffect(() => {
    window.localStorage.setItem("voh.execution-mode", executionMode);
  }, [executionMode]);
  useEffect(() => {
    setApprovedPlanText(activeTask.data?.task.planContent ?? "");
  }, [activeTask.data?.task.id, activeTask.data?.task.planContent]);
  const templates = trpc.templates.list.useQuery(undefined, {
    enabled: !project,
    refetchOnWindowFocus: false,
    staleTime: 300_000,
  });
  const templateReady =
    Boolean(project) ||
    (!templates.isLoading &&
      !templates.isError &&
      Boolean(
        templates.data?.some(template => template.kind === templateKind)
      ));
  const suggestions = project
    ? [
        `Continue working on ${project.name}`,
        `Improve ${project.name}`,
        `Fix ${project.name}`,
        "Review recent changes",
        "Make it faster",
      ]
    : creationSuggestions;

  const submit = () => {
    const trimmedObjective = objective.trim();
    if (
      !trimmedObjective ||
      pending ||
      readingAttachments ||
      submissionLock.current ||
      !templateReady
    )
      return;
    if (
      attachments.length &&
      trimmedObjective.length > MAX_OBJECTIVE_WITH_FILES
    ) {
      setAttachmentError(
        `Shorten the objective to ${MAX_OBJECTIVE_WITH_FILES.toLocaleString()} characters to include attached files.`
      );
      return;
    }
    setAttachmentError("");
    if (attachments.length) {
      submissionLock.current = true;
      setReadingAttachments(true);
      void Promise.all(
        attachments.map(async file => ({
          name: file.name,
          content: await file.text(),
        }))
      )
        .then(files => {
          const context = buildAttachmentContext(files);
          onSubmit(
            `${trimmedObjective}${context}`,
            mode,
            templateKind,
            executionMode
          );
          setWatchForNewTasks(true);
          setObjective("");
          setAttachments([]);
          window.setTimeout(() => {
            submissionLock.current = false;
          }, 1500);
        })
        .catch(error => {
          setAttachmentError(
            `Could not read an attached file: ${error instanceof Error ? error.message : "Unknown file error"}`
          );
          submissionLock.current = false;
        })
        .finally(() => setReadingAttachments(false));
      return;
    }
    submissionLock.current = true;
    onSubmit(trimmedObjective, mode, templateKind, executionMode);
    setWatchForNewTasks(true);
    setObjective("");
    window.setTimeout(() => {
      submissionLock.current = false;
    }, 1500);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachmentError("");
    const availableSlots = Math.max(
      0,
      MAX_ATTACHMENT_COUNT - attachments.length
    );
    const rejected: string[] = [];
    const accepted = Array.from(files)
      .filter(file => {
        if (!isSupportedContextFile(file.name)) {
          rejected.push(`${file.name}: unsupported file type`);
          return false;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name}: exceeds 64 KB`);
          return false;
        }
        return true;
      })
      .slice(0, availableSlots);
    if (files.length > availableSlots)
      rejected.push("Only five files can be attached per run");
    setAttachments(current => [...current, ...accepted]);
    if (rejected.length) setAttachmentError(rejected.join(". "));
  };

  return (
    <section className="automation-hero">
      <div className="mx-auto max-w-[780px] text-center">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[.22em] text-[#888]">
          {project ? "Continue working" : "Your intelligent workspace"}
        </div>
        <h2 className="text-[30px] font-semibold tracking-[-.04em] text-[#f4f4f4] sm:text-[38px]">
          {project
            ? "What do you want to change?"
            : "What do you want to build or do?"}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#858585]">
          Describe the outcome in your own words. VOH organizes the plan, work,
          and evidence around it.
        </p>
        <div className="mt-7 rounded-2xl border border-[#303030] bg-[#151515] p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.18)] transition-colors focus-within:border-[#666]">
          <textarea
            ref={objectiveRef}
            value={objective}
            maxLength={MAX_OBJECTIVE_LENGTH}
            disabled={readingAttachments}
            onChange={event => setObjective(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                submit();
            }}
            rows={4}
            placeholder={
              project
                ? "What should VOH change?"
                : "What do you want to build or automate?"
            }
            className="w-full resize-none bg-transparent px-3 py-2 text-[16px] leading-7 text-[#f2f2f2] outline-none placeholder:text-[#666]"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#292929] px-2 pt-3">
              {attachments.map((file, index) => (
                <span key={`${file.name}-${index}`} className="attachment-chip">
                  <Paperclip size={12} />
                  {file.name}
                  <button
                    type="button"
                    disabled={readingAttachments}
                    onClick={() =>
                      setAttachments(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#292929] px-2 pt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                disabled={readingAttachments}
                accept=".txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.yml,.yaml,.xml,.log,.sql,.py,.go,.rs,.java,.sh,.toml,.ini"
                className="hidden"
                onChange={event => {
                  addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="tool-button"
                disabled={readingAttachments}
                onClick={() => fileRef.current?.click()}
                title="Attach files"
                aria-label="Attach text or code files"
              >
                <Paperclip size={15} />
              </button>
              <label className="mode-select-wrap">
                <span className="sr-only">VOH AI execution mode</span>
                <select
                  className="mode-select"
                  value={executionMode}
                  disabled={readingAttachments}
                  onChange={event =>
                    setExecutionMode(event.target.value as ExecutionMode)
                  }
                >
                  <option value="chat" disabled={!project}>
                    Chat
                  </option>
                  <option value="plan" disabled={!project}>
                    Plan
                  </option>
                  <option value="build">Build</option>
                  <option value="build_more" disabled={!project}>
                    Build More
                  </option>
                </select>
                <ChevronDown size={13} aria-hidden="true" />
              </label>
              <button
                type="button"
                className="mode-button"
                disabled={readingAttachments}
                aria-pressed={mode === "developer"}
                onClick={() =>
                  setMode(mode === "simple" ? "developer" : "simple")
                }
                title="Toggle developer execution details"
              >
                {mode === "simple" ? "Simple view" : "Developer view"}
              </button>
            </div>
            <button
              type="button"
              disabled={
                !objective.trim() ||
                pending ||
                readingAttachments ||
                !templateReady
              }
              onClick={submit}
              className="primary-action"
            >
              {pending || readingAttachments ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <ArrowUp size={15} />
              )}
              {readingAttachments
                ? "Reading files"
                : pending
                  ? "Sending"
                  : executionMode === "chat"
                    ? "Send"
                    : executionMode === "plan"
                      ? "Create plan"
                      : executionMode === "build_more"
                        ? "Build more"
                        : "Build"}
            </button>
          </div>
          {attachmentError && (
            <p className="composer-error" role="alert">
              {attachmentError}
            </p>
          )}
          {submissionError && (
            <p className="composer-error" role="alert">
              Could not submit the task: {submissionError}
            </p>
          )}
          <p className="composer-hint">
            Attach up to five text or code files (64 KB each). PDF and image
            understanding isn’t enabled yet.
          </p>
          <p className="composer-hint" role="note">
            {executionMode === "chat"
              ? "Read-only conversation with project context; no file writes or commands."
              : executionMode === "plan"
                ? "Inspects the workspace and waits for your approval before implementation."
                : executionMode === "build_more"
                  ? "Extends an existing workspace and preserves source files that do not need changes."
                  : "Executes the task through the build workflow and verifies supported checks."}
          </p>
        </div>
        {!project && (
          <div className="starter-template">
            <label htmlFor="starter-template">Start from</label>
            <select
              id="starter-template"
              value={templateKind}
              onChange={event =>
                setTemplateKind(event.target.value as TemplateKind)
              }
              disabled={
                readingAttachments || templates.isLoading || templates.isError
              }
            >
              {templates.data?.map(template => (
                <option key={template.kind} value={template.kind}>
                  {template.name}
                </option>
              ))}
            </select>
            <span>
              {templates.isLoading
                ? "Loading executable starters…"
                : templates.isError
                  ? "Starter catalog unavailable"
                  : (templates.data?.find(item => item.kind === templateKind)
                      ?.runtime ?? "Choose an executable workspace starter")}
            </span>
          </div>
        )}
        {(executionMode === "build" || executionMode === "build_more") && (
          <CreationPlanPreview objective={objective} />
        )}
        {project && (
          <TaskHistoryPanel
            tasks={projectTasks.data ?? []}
            selectedTaskId={selectedTaskId ?? activeTaskId ?? undefined}
            activeTaskId={activeTaskId ?? undefined}
            loading={projectTasks.isLoading}
            error={
              projectTasks.isError
                ? `Could not load task history: ${projectTasks.error.message}`
                : undefined
            }
            onSelect={onSelectTask}
            onReuse={previousObjective => {
              setObjective(previousObjective);
              objectiveRef.current?.focus();
            }}
          />
        )}
        {activeTask.data?.task && (
          <div className="mt-4 text-left">
            {activeTask.data.task.executionMode === "plan" &&
              activeTask.data.task.status === "waiting" &&
              activeTask.data.task.planContent && (
                <section className="plan-approval-card">
                  <div className="plan-approval-heading">
                    Plan ready · no changes made
                  </div>
                  <p className="plan-approval-copy">
                    Review or edit this persisted plan. Approval passes this
                    exact version to the build engine.
                  </p>
                  <label
                    className="sr-only"
                    htmlFor={`approved-plan-${activeTask.data.task.id}`}
                  >
                    Edit the plan before approval
                  </label>
                  <textarea
                    id={`approved-plan-${activeTask.data.task.id}`}
                    value={approvedPlanText}
                    maxLength={12000}
                    onChange={event => setApprovedPlanText(event.target.value)}
                    rows={10}
                    className="plan-approval-input"
                    disabled={approvePlan.isPending}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-[#78908e]">
                      {approvedPlanText.length}/12000
                    </span>
                    <button
                      type="button"
                      className="primary-action"
                      disabled={
                        !activeTask.data?.task.id ||
                        !approvedPlanText.trim() ||
                        approvePlan.isPending
                      }
                      onClick={() => {
                        const taskId = activeTask.data?.task.id;
                        if (!taskId) return;
                        approvePlan.mutate({
                          taskId,
                          approvedPlan: approvedPlanText.trim(),
                        });
                      }}
                    >
                      {approvePlan.isPending ? "Approving…" : "Approve & build"}
                    </button>
                  </div>
                  {approvePlan.isError && (
                    <p className="composer-error" role="alert">
                      Could not approve the plan: {approvePlan.error.message}
                    </p>
                  )}
                </section>
              )}
            {activeTask.data.task.status === "completed" &&
              activeTask.data.task.executionMode === "chat" &&
              activeTask.data.task.finalSummary && (
                <section className="chat-response-card" aria-live="polite">
                  <div className="plan-approval-heading">VOH AI · Chat</div>
                  <p>{activeTask.data.task.finalSummary}</p>
                </section>
              )}
            {activeTask.data.task.status === "failed" &&
              activeTask.data.task.finalSummary && (
                <p className="composer-error" role="alert">
                  {activeTask.data.task.finalSummary}
                </p>
              )}
            <TaskRunControls task={activeTask.data.task} />
          </div>
        )}
        {!objective.trim() &&
          dismissedSuggestionTask !== (activeTask.data?.task.id ?? 0) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(activeTask.data?.task.status === "failed"
                ? [
                    "Inspect and fix the last failure",
                    "Review the latest changes",
                  ]
                : activeTask.data?.task.status === "completed" &&
                    activeTask.data.task.executionMode !== "chat"
                  ? ["Run the tests", "Review the latest changes"]
                  : suggestions
              ).map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={readingAttachments}
                  onClick={() => {
                    setObjective(suggestion);
                    setDismissedSuggestionTask(activeTask.data?.task.id ?? 0);
                    setExecutionMode(
                      /review|analyze/i.test(suggestion)
                        ? "chat"
                        : project
                          ? "build_more"
                          : "build"
                    );
                  }}
                  className="suggestion-chip"
                >
                  <Sparkles size={12} />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        {!project && (
          <button
            type="button"
            onClick={onCreateProject}
            className="mt-5 inline-flex items-center gap-2 text-xs text-[#777] transition hover:text-[#eee]"
          >
            <Plus size={13} />
            Or create a named workspace first
          </button>
        )}
      </div>
    </section>
  );
}

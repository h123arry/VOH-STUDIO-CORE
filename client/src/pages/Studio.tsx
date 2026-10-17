import {
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import ProjectRail from "@/components/studio/ProjectRail";
import TaskComposer from "@/components/studio/TaskComposer";
import PlanStream from "@/components/studio/PlanStream";
import ActivityTimeline from "@/components/studio/ActivityTimeline";
import WorkspacePanel from "@/components/studio/WorkspacePanel";
import Inspector from "@/components/studio/Inspector";
import DeveloperLog from "@/components/studio/DeveloperLog";
import TaskChangesPanel from "@/components/studio/TaskChangesPanel";
import WorkspaceRecoveryPanel from "@/components/studio/WorkspaceRecoveryPanel";
import ProjectMemoryPanel from "@/components/studio/ProjectMemoryPanel";
import EvolutionPulse from "@/components/studio/EvolutionPulse";
import LifecyclePanel from "@/components/studio/LifecyclePanel";
import ProductIntelligencePanel from "@/components/studio/ProductIntelligencePanel";
import type { ExecutionMode, Project, TemplateKind } from "@/lib/studio-types";
import { statusTone, taskActivity } from "@/lib/studio-types";

function BrandMark() {
  return <div className="ash-mark">V</div>;
}
function CommandPalette({
  projects,
  onClose,
  onNew,
  onSelect,
  onDetails,
}: {
  projects: Project[];
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: number) => void;
  onDetails: () => void;
}) {
  const [query, setQuery] = useState("");
  const items = [
    { label: "New project", hint: "Create a workspace", action: onNew },
    {
      label: "Show advanced details",
      hint: "Preview, files, logs, Git",
      action: onDetails,
    },
    ...projects.map(project => ({
      label: project.name,
      hint: "Open project",
      action: () => onSelect(project.id),
    })),
  ].filter(item => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[13vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="command-palette"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#2b2b2b] px-4">
          <Search size={17} className="text-[#888]" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search projects, tasks, files, and commands"
            className="h-14 flex-1 bg-transparent text-sm text-[#f2f2f2] outline-none placeholder:text-[#666]"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="p-2">
          {items.length ? (
            items.map(item => (
              <button
                key={item.label}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="command-row"
              >
                <Command size={15} className="text-[#888]" />
                <span className="flex-1 text-left text-sm text-[#eee]">
                  {item.label}
                </span>
                <span className="text-xs text-[#666]">{item.hint}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-[#777]">
              No matching work yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Studio() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const projects = projectsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<number>();
  const [selectedTaskId, setSelectedTaskId] = useState<number>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [showNewProject, setShowNewProject] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [palette, setPalette] = useState(false);
  const [light, setLight] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId) ?? projects[0],
    [projects, selectedId]
  );
  useEffect(() => {
    if (selectedProject && selectedProject.id !== selectedId)
      setSelectedId(selectedProject.id);
  }, [selectedProject, selectedId]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(value => !value);
      }
      if (event.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const detailQuery = trpc.projects.get.useQuery(
    { projectId: selectedProject?.id ?? 0 },
    {
      enabled: Boolean(auth.isAuthenticated && selectedProject),
      refetchOnWindowFocus: false,
    }
  );
  const detail = detailQuery.data;
  const evolutionSummary = trpc.intelligence.summary.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const skillRecommendations = trpc.skills.recommend.useQuery(
    {
      objective:
        selectedProject?.description ??
        "Build a production-grade web application",
    },
    { enabled: auth.isAuthenticated, refetchOnWindowFocus: false }
  );
  const taskId =
    selectedTaskId ?? selectedProject?.activeTaskId ?? detail?.tasks[0]?.id;
  const currentRunTaskId =
    selectedProject?.activeTaskId ?? detail?.tasks[0]?.id;
  const taskQuery = trpc.tasks.get.useQuery(
    { taskId: taskId ?? 0 },
    {
      enabled: Boolean(auth.isAuthenticated && taskId),
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
  const bundle = taskQuery.data;
  const currentRunQuery = trpc.tasks.get.useQuery(
    { taskId: currentRunTaskId ?? 0 },
    {
      enabled: Boolean(auth.isAuthenticated && currentRunTaskId),
      refetchInterval: query => {
        const current = query.state.data?.task;
        if (
          current?.status === "waiting" &&
          current.executionMode === "plan" &&
          !current.approvedPlan
        )
          return false;
        return [
          "queued",
          "planning",
          "running",
          "waiting",
          "testing",
          "debugging",
        ].includes(current?.status ?? "")
          ? 3000
          : false;
      },
      refetchOnWindowFocus: false,
    }
  );
  const currentRunBundle =
    currentRunQuery.data ?? (currentRunTaskId === taskId ? bundle : undefined);
  useEffect(() => {
    if (
      selectedProject &&
      ["completed", "failed", "cancelled"].includes(
        currentRunBundle?.task.status ?? ""
      )
    ) {
      void utils.projects.get.invalidate({ projectId: selectedProject.id });
    }
  }, [
    currentRunBundle?.task.id,
    currentRunBundle?.task.status,
    selectedProject?.id,
  ]);
  const projectCreate = trpc.projects.create.useMutation({
    onSuccess: async project => {
      await utils.projects.list.invalidate();
      setSelectedId(project.id);
      setShowNewProject(false);
    },
  });
  const taskCreate = trpc.tasks.create.useMutation({
    onSuccess: async result => {
      setSelectedId(result.project.id);
      setSelectedTaskId(result.task.id);
      await Promise.all([
        utils.projects.list.invalidate(),
        utils.projects.get.invalidate(),
      ]);
    },
  });
  const taskRetry = trpc.tasks.retry.useMutation({
    onSuccess: () => utils.tasks.get.invalidate(),
  });
  const taskCancel = trpc.tasks.cancel.useMutation({
    onSuccess: () => utils.tasks.get.invalidate(),
  });
  const createProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    projectCreate.mutate({
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      projectType: String(form.get("projectType") ?? "web_app") as "web_app",
    });
  };
  const submitObjective = (
    objective: string,
    viewMode: "simple" | "developer",
    selectedTemplate: TemplateKind,
    executionMode: ExecutionMode
  ) =>
    taskCreate.mutate({
      projectId: selectedProject?.id,
      projectName:
        selectedProject?.name ??
        `New ${selectedTemplate.replace(/_/g, " ")} workspace`,
      description: selectedProject?.description ?? objective,
      projectType:
        (selectedProject?.projectType as TemplateKind | undefined) ??
        selectedTemplate,
      objective,
      viewMode,
      executionMode,
    });
  if (!auth.isAuthenticated)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="mx-auto mb-5 flex w-fit items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-sm font-semibold tracking-[.18em] text-[#f4f4f4]">
                VOH STUDIO
              </div>
              <div className="text-[10px] tracking-[.18em] text-[#777]">
                POWERED BY VOH
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-[#f4f4f4]">
            One intelligent workspace.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#888]">
            Describe the outcome. VOH organizes the plan, work, and evidence
            around it.
          </p>
          <button
            onClick={() => startLogin()}
            className="primary-action mx-auto mt-7"
          >
            <Play size={15} /> Continue to VOH STUDIO
          </button>
        </div>
      </div>
    );
  const running = Boolean(
    currentRunBundle &&
      [
        "queued",
        "planning",
        "running",
        "waiting",
        "testing",
        "debugging",
      ].includes(currentRunBundle.task.status)
  );
  const currentStatus = statusTone(currentRunBundle?.task.status);
  const activity = taskActivity(
    currentRunBundle?.task,
    currentRunBundle?.events,
    currentRunBundle?.toolCalls
  );
  return (
    <div className={`${light ? "theme-light" : ""} app-shell`}>
      <header className="topbar">
        <div className="flex items-center gap-3">
          <button
            className="icon-button md:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="hidden md:block">
            <BrandMark />
          </div>
          <span className="hidden text-xs font-medium tracking-[.16em] text-[#e9e9e9] sm:inline">
            VOH STUDIO
          </span>
          {selectedProject && (
            <>
              <span className="text-[#555]">/</span>
              <span className="max-w-[180px] truncate text-sm text-[#aaa]">
                {selectedProject.name}
              </span>
              <span className="hidden text-[9px] tracking-[.16em] text-[#666] lg:inline">
                POWERED BY VOH
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPalette(true)} className="search-trigger">
            <Search size={14} />{" "}
            <span className="hidden sm:inline">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            className="icon-button"
            onClick={() => setLight(value => !value)}
            aria-label="Toggle appearance"
          >
            <Settings2 size={16} />
          </button>
          <div className="hidden items-center gap-2 border-l border-[#292929] pl-3 sm:flex">
            <div className="avatar">
              <UserRound size={14} />
            </div>
            <span className="text-xs text-[#aaa]">
              {auth.user?.name ?? "Operator"}
            </span>
            <button
              onClick={() => auth.logout()}
              className="icon-button"
              aria-label="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>
      <div className="app-body">
        <div className={`${mobileNav ? "mobile-open" : ""} nav-layer`}>
          <ProjectRail
            projects={projects}
            selectedId={selectedProject?.id}
            onSelect={id => {
              setSelectedId(id);
              setSelectedTaskId(undefined);
              setSelectedPath(undefined);
              setMobileNav(false);
            }}
            onNew={() => {
              setShowNewProject(true);
              setMobileNav(false);
            }}
            collapsed={collapsed}
            onToggle={() => setCollapsed(value => !value)}
            onSearch={() => setPalette(true)}
          />
        </div>
        {mobileNav && (
          <button
            className="mobile-scrim"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          />
        )}
        <main className="main-workspace">
          <div className="workspace-inner">
            <div className="workspace-heading">
              <div>
                <div className="eyebrow">
                  <SlidersHorizontal size={13} />{" "}
                  {running ? "VOH is working" : "Command center"}
                </div>
                <h1>{selectedProject?.name ?? "Build anything"}</h1>
                <p>
                  {running
                    ? "Your project is being built. Progress is visible below; advanced details stay tucked away."
                    : (selectedProject?.description ??
                      "A calm workspace for ideas, automation, and product engineering.")}
                </p>
              </div>
              {selectedProject && (
                <div
                  className={`status-pill ${currentStatus === "active" ? "working" : ""} ${currentStatus === "danger" ? "failed" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <span />{" "}
                  {currentRunBundle ? activity.label : "VOH AI is ready"}
                </div>
              )}
            </div>
            <TaskComposer
              project={selectedProject}
              onSubmit={submitObjective}
              onCreateProject={() => setShowNewProject(true)}
              pending={taskCreate.isPending}
              submissionError={
                taskCreate.isError ? taskCreate.error.message : undefined
              }
              selectedTaskId={taskId}
              onSelectTask={id => {
                setSelectedTaskId(id);
                setShowDetails(true);
              }}
            />
            {currentRunBundle && (
              <div className="happening-panel">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="eyebrow">
                      {running ? "VOH AI activity" : "Task status"}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[#ddd]">
                      {running && (
                        <span className="activity-pulse" aria-hidden="true" />
                      )}
                      {activity.label}
                    </div>
                    {!running && currentRunBundle.task.finalSummary && (
                      <p
                        className={`mt-2 max-w-2xl text-xs leading-5 ${currentRunBundle.task.status === "failed" ? "text-[#f2a39a]" : "text-[#81908d]"}`}
                      >
                        {currentRunBundle.task.finalSummary}
                      </p>
                    )}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setShowDetails(value => !value)}
                  >
                    {showDetails ? "Hide details" : "Show details"}
                    <ChevronDown
                      size={14}
                      className={showDetails ? "rotate-180" : ""}
                    />
                  </button>
                </div>
                {running && (
                  <div
                    className="mt-3 h-1 overflow-hidden rounded-full bg-[#292929]"
                    aria-label={`Task progress ${currentRunBundle.task.progress}%`}
                  >
                    <div
                      className="h-full rounded-full bg-[#d7d7d7] transition-all"
                      style={{ width: `${currentRunBundle.task.progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {!selectedProject && (
              <div className="empty-home">
                <div className="text-4xl text-[#555]">✦</div>
                <div className="mt-3 text-sm text-[#aaa]">
                  Nothing here yet.
                </div>
                <div className="mt-1 text-xs text-[#666]">
                  Start with an idea and let VOH build it.
                </div>
              </div>
            )}
            {selectedProject && !running && (
              <div className="recent-strip">
                <div>
                  <div className="eyebrow">Recent work</div>
                  <div className="mt-1 text-sm text-[#bbb]">
                    Continue the conversation or ask for a change above.
                  </div>
                </div>
                <button
                  className="secondary-action"
                  onClick={() => setShowDetails(true)}
                >
                  Open project details
                </button>
              </div>
            )}
            {showDetails && (
              <div className="advanced-space">
                <ProductIntelligencePanel
                  projectId={selectedProject?.id}
                  objective={selectedProject?.description}
                />
                <EvolutionPulse
                  summary={evolutionSummary.data}
                  skills={skillRecommendations.data}
                />
                <LifecyclePanel projectId={selectedProject?.id} />
                <ProjectMemoryPanel projectId={selectedProject?.id} />
                <div className="details-grid">
                  <div className="detail-section">
                    <div className="section-heading">Execution plan</div>
                    <PlanStream steps={bundle?.steps ?? []} />
                  </div>
                  <div className="detail-section">
                    <div className="section-heading">Workspace</div>
                    <WorkspacePanel
                      detail={detail ?? undefined}
                      selectedPath={selectedPath}
                      onSelect={setSelectedPath}
                    />
                  </div>
                  <div className="detail-section space-y-3">
                    <TaskChangesPanel bundle={bundle ?? undefined} />
                    <WorkspaceRecoveryPanel detail={detail ?? undefined} />
                  </div>
                  <div className="detail-section">
                    <div className="section-heading">Activity</div>
                    <ActivityTimeline events={bundle?.events ?? []} />
                  </div>
                  {bundle?.task.viewMode === "developer" && (
                    <DeveloperLog bundle={bundle} />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
        {showDetails && (
          <Inspector
            task={bundle?.task}
            agents={bundle?.agents ?? []}
            verifications={bundle?.verifications ?? []}
            quality={bundle?.quality}
            onRetry={taskId ? () => taskRetry.mutate({ taskId }) : undefined}
            onCancel={taskId ? () => taskCancel.mutate({ taskId }) : undefined}
          />
        )}
      </div>
      {palette && (
        <CommandPalette
          projects={projects}
          onClose={() => setPalette(false)}
          onNew={() => setShowNewProject(true)}
          onSelect={id => setSelectedId(id)}
          onDetails={() => setShowDetails(true)}
        />
      )}
      {showNewProject && (
        <div className="modal-layer">
          <form onSubmit={createProject} className="modal-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="eyebrow">New workspace</div>
                <h2 className="mt-2 text-xl font-semibold text-[#f1f1f1]">
                  Start with a real project.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="icon-button"
              >
                <X size={17} />
              </button>
            </div>
            <label className="form-label">
              Project name
              <input required name="name" placeholder="e.g. Atlas Dashboard" />
            </label>
            <label className="form-label">
              What is it?
              <textarea
                required
                name="description"
                rows={3}
                placeholder="Describe the product this workspace will hold…"
              />
            </label>
            <label className="form-label">
              Project type
              <select name="projectType">
                <option value="web_app">Web application</option>
                <option value="website">Website</option>
                <option value="api">API</option>
                <option value="ai_app">AI application</option>
                <option value="automation">Automation</option>
                <option value="dashboard">Dashboard</option>
                <option value="game">Game</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="text-button"
              >
                Cancel
              </button>
              <button
                disabled={projectCreate.isPending}
                className="primary-action"
              >
                <Plus size={14} /> Create workspace
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

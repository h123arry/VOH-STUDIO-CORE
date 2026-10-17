import { Clock3, History, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Task } from "@/lib/studio-types";
import { statusTone, timeAgo } from "@/lib/studio-types";

type HistoryFilter = "all" | "active" | "completed" | "attention";
const activeStatuses = [
  "queued",
  "planning",
  "running",
  "waiting",
  "testing",
  "debugging",
  "paused",
];

export default function TaskHistoryPanel({
  tasks,
  selectedTaskId,
  activeTaskId,
  loading,
  error,
  onSelect,
  onReuse,
}: {
  tasks: Task[];
  selectedTaskId?: number;
  activeTaskId?: number;
  loading: boolean;
  error?: string;
  onSelect: (taskId: number) => void;
  onReuse: (objective: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter(task => {
      const matchesQuery =
        !normalizedQuery ||
        task.objective.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && activeStatuses.includes(task.status)) ||
        (filter === "completed" && task.status === "completed") ||
        (filter === "attention" &&
          ["failed", "cancelled"].includes(task.status));
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, tasks]);

  return (
    <section className="task-history">
      <button
        type="button"
        className="task-history-toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="flex items-center gap-2">
          <History size={14} />
          Task history
          <span className="task-history-count">{tasks.length}</span>
        </span>
        <span className="text-[10px] text-[#718580]">
          {activeTaskId
            ? "Browse and reuse previous runs"
            : "Search previous runs"}
        </span>
      </button>
      {open && (
        <div className="task-history-list">
          <div className="task-history-search">
            <Search size={13} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search task objectives"
              aria-label="Search task history"
            />
          </div>
          <div
            className="task-history-filters"
            aria-label="Filter task history"
          >
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["completed", "Completed"],
                ["attention", "Needs attention"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "selected" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {loading ? (
            <p className="task-history-muted">Loading task history…</p>
          ) : error ? (
            <p className="task-history-error" role="alert">
              {error}
            </p>
          ) : visibleTasks.length === 0 ? (
            <p className="task-history-muted">
              {tasks.length
                ? "No runs match these filters."
                : "Project runs will appear here."}
            </p>
          ) : (
            <ol className="task-history-rows">
              {visibleTasks.map(task => (
                <TaskHistoryRow
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  onSelect={() => onSelect(task.id)}
                  onReuse={() => onReuse(task.objective)}
                />
              ))}
            </ol>
          )}
          {activeTaskId && selectedTaskId !== activeTaskId && (
            <button
              type="button"
              className="task-history-latest"
              onClick={() => onSelect(activeTaskId)}
            >
              Return to latest run
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function TaskHistoryRow({
  task,
  selected,
  onSelect,
  onReuse,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onReuse: () => void;
}) {
  const tone = statusTone(task.status);
  return (
    <li className={`task-history-row ${selected ? "selected" : ""}`}>
      <button type="button" className="task-history-select" onClick={onSelect}>
        <span className="block truncate text-xs text-[#d8e3e0]">
          {task.objective}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[10px] text-[#708581]">
          <Clock3 size={10} />
          {timeAgo(task.createdAt)}
        </span>
      </button>
      <span className={`task-history-status ${tone}`}>{task.status}</span>
      <button
        type="button"
        className="task-history-reuse"
        onClick={onReuse}
        title="Put this objective back in the composer"
        aria-label="Reuse this task objective"
      >
        <RotateCcw size={12} />
      </button>
    </li>
  );
}

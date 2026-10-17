import { Pause, Play, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/lib/studio-types";
import { trpc } from "@/lib/trpc";

const activeStatuses = [
  "queued",
  "planning",
  "running",
  "waiting",
  "testing",
  "debugging",
];

export default function TaskRunControls({ task }: { task: Task }) {
  const [instruction, setInstruction] = useState("");
  const utils = trpc.useUtils();
  const isActive = activeStatuses.includes(task.status);
  const canQueue = isActive || task.status === "paused";
  const queued = trpc.tasks.queuedInstructions.useQuery(
    { projectId: task.projectId, taskId: task.id },
    {
      enabled: canQueue,
      refetchInterval: isActive ? 5000 : false,
      refetchOnWindowFocus: false,
    }
  );

  const refreshTask = async () => {
    await Promise.all([
      utils.tasks.get.invalidate({ taskId: task.id }),
      utils.tasks.queuedInstructions.invalidate({
        projectId: task.projectId,
        taskId: task.id,
      }),
    ]);
  };
  const pause = trpc.tasks.pause.useMutation({ onSuccess: refreshTask });
  const resume = trpc.tasks.resume.useMutation({ onSuccess: refreshTask });
  const queue = trpc.tasks.queueInstruction.useMutation({
    onSuccess: async () => {
      setInstruction("");
      await refreshTask();
    },
  });
  const cancelInstruction = trpc.tasks.cancelInstruction.useMutation({
    onSuccess: refreshTask,
  });

  const submitInstruction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = instruction.trim();
    if (value.length >= 4 && value.length <= 4000 && !queue.isPending) {
      queue.mutate({ taskId: task.id, instruction: value });
    }
  };

  if (!canQueue) return null;

  return (
    <section className="rounded-lg border border-[#1b3539] bg-[#0b1a20] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#58716f]">
            Steer this run
          </div>
          <div className="mt-1 text-[11px] text-[#78908e]">
            Follow-ups run after the current task completes successfully.
          </div>
        </div>
        {task.status === "paused" ? (
          <button
            type="button"
            className="run-control-button"
            disabled={resume.isPending}
            onClick={() => resume.mutate({ taskId: task.id })}
          >
            <Play size={13} />
            {resume.isPending ? "Resuming…" : "Resume"}
          </button>
        ) : isActive ? (
          <button
            type="button"
            className="run-control-button"
            disabled={pause.isPending}
            onClick={() => pause.mutate({ taskId: task.id })}
          >
            <Pause size={13} />
            {pause.isPending ? "Pausing…" : "Pause"}
          </button>
        ) : null}
      </div>

      <form onSubmit={submitInstruction}>
        <label className="sr-only" htmlFor={`follow-up-${task.id}`}>
          Queue a follow-up instruction
        </label>
        <textarea
          id={`follow-up-${task.id}`}
          rows={2}
          maxLength={4000}
          value={instruction}
          onChange={event => setInstruction(event.target.value)}
          placeholder="Add a follow-up for VOH to do next…"
          className="w-full resize-y rounded-md border border-[#263f43] bg-[#071016] p-2 text-xs leading-5 text-[#dcece8] outline-none placeholder:text-[#627c79] focus:border-[#7df2c5]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#627c79]">
            {instruction.length}/4000
          </span>
          <button
            type="submit"
            className="run-control-button"
            disabled={instruction.trim().length < 4 || queue.isPending}
          >
            <Send size={12} />
            {queue.isPending ? "Queueing…" : "Queue next"}
          </button>
        </div>
      </form>

      {queued.isError && (
        <p className="mt-3 text-xs text-[#f0a69c]" role="alert">
          Could not load queued work: {queued.error.message}
        </p>
      )}
      {queue.isError && (
        <p className="mt-3 text-xs text-[#f0a69c]" role="alert">
          Could not queue this instruction: {queue.error.message}
        </p>
      )}
      {cancelInstruction.isError && (
        <p className="mt-3 text-xs text-[#f0a69c]" role="alert">
          Could not remove the queued instruction:{" "}
          {cancelInstruction.error.message}
        </p>
      )}
      {(pause.isError || resume.isError) && (
        <p className="mt-3 text-xs text-[#f0a69c]" role="alert">
          Could not update the run: {(pause.error ?? resume.error)?.message}
        </p>
      )}

      {queued.data && queued.data.length > 0 && (
        <div className="mt-4 border-t border-[#1b3539] pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#78908e]">
            Queued next · {queued.data.length}
          </div>
          <ol className="space-y-2">
            {queued.data.map((item, index) => (
              <li
                key={item.id}
                className="flex gap-2 text-xs leading-5 text-[#b7cbc6]"
              >
                <span className="font-mono text-[#7df2c5]">{index + 1}.</span>
                <span className="break-words">{item.instruction}</span>
                <button
                  type="button"
                  className="queued-instruction-remove"
                  disabled={cancelInstruction.isPending}
                  onClick={() =>
                    cancelInstruction.mutate({
                      taskId: task.id,
                      instructionId: item.id,
                    })
                  }
                  aria-label={`Remove queued instruction: ${item.instruction}`}
                  title="Remove queued instruction"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

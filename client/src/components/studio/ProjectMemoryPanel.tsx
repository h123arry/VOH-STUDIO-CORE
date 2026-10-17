import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ProjectMemoryPanel({
  projectId,
}: {
  projectId?: number;
}) {
  const settings = trpc.projects.settings.get.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: Boolean(projectId), refetchOnWindowFocus: false }
  );
  const utils = trpc.useUtils();
  const update = trpc.projects.settings.update.useMutation({
    onSuccess: async () => {
      if (projectId)
        await utils.projects.settings.get.invalidate({ projectId });
    },
  });
  const [memory, setMemory] = useState("");

  useEffect(() => {
    setMemory(settings.data?.projectMemory ?? "");
  }, [projectId, settings.data?.projectMemory]);

  const save = (value: string) => {
    if (!projectId || !settings.data || update.isPending) return;
    update.mutate({ projectId, settings: { ...settings.data, projectMemory: value.trim() } });
  };

  return (
    <section className="detail-section" aria-labelledby="project-memory-title">
      <div className="section-heading" id="project-memory-title">
        Project memory
      </div>
      <p className="mt-2 text-xs leading-5 text-[#858585]">
        Save project-specific preferences, decisions, and constraints for VOH AI
        to reuse. Current repository files remain the source of truth.
      </p>
      {settings.isLoading ? (
        <p className="mt-3 text-xs text-[#858585]" role="status">
          Loading saved project context…
        </p>
      ) : settings.isError ? (
        <p className="mt-3 text-xs text-[#f2a39a]" role="alert">
          Could not load project memory: {settings.error.message}
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor={`project-memory-${projectId}`}>
            Saved project context
          </label>
          <textarea
            id={`project-memory-${projectId}`}
            value={memory}
            maxLength={4000}
            rows={5}
            onChange={event => setMemory(event.target.value)}
            placeholder="For example: Keep the existing React and tRPC architecture. Prefer small, accessible UI changes."
            className="mt-3 w-full resize-y rounded-md border border-[#303030] bg-[#111] p-3 text-sm leading-5 text-[#ddd] outline-none placeholder:text-[#666] focus:border-[#777]"
            disabled={update.isPending}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] text-[#777]">
              {memory.length}/4000 · Do not save credentials or secrets
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-button"
                disabled={!settings.data?.projectMemory || update.isPending}
                onClick={() => {
                  setMemory("");
                  save("");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={
                  update.isPending ||
                  memory === (settings.data?.projectMemory ?? "")
                }
                onClick={() => save(memory)}
              >
                {update.isPending ? "Saving…" : "Save memory"}
              </button>
            </div>
          </div>
          {update.isError && (
            <p className="mt-2 text-xs text-[#f2a39a]" role="alert">
              Could not save project memory: {update.error.message}
            </p>
          )}
          {update.isSuccess && (
            <p className="mt-2 text-xs text-[#9aaa9b]" role="status">
              Project memory saved for this workspace.
            </p>
          )}
        </>
      )}
    </section>
  );
}

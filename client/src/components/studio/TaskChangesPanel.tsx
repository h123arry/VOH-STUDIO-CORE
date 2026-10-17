import { FileCode2 } from "lucide-react";
import type { TaskBundle } from "@/lib/studio-types";

export default function TaskChangesPanel({ bundle }: { bundle?: TaskBundle }) {
  const paths = new Set(
    (bundle?.artifacts ?? [])
      .filter(artifact => artifact.kind === "source")
      .map(artifact => artifact.path)
  );
  for (const event of bundle?.events ?? []) {
    if (
      !["workspace.incremental", "workspace.generated"].includes(
        event.eventType
      ) ||
      !event.metadata
    )
      continue;
    try {
      const metadata: unknown = JSON.parse(event.metadata);
      if (!metadata || typeof metadata !== "object") continue;
      const values = metadata as Record<string, unknown>;
      for (const candidate of [values.changed, values.files]) {
        if (!Array.isArray(candidate)) continue;
        for (const path of candidate) {
          if (typeof path === "string" && !/(^|\/)\.env(?:\.|$)/i.test(path))
            paths.add(path);
        }
      }
    } catch {
      continue;
    }
  }

  return (
    <section className="task-changes">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#718580]">
        <FileCode2 size={13} />
        Files recorded for this task
      </div>
      {paths.size === 0 ? (
        <p className="mt-2 text-xs text-[#627c79]">
          No source-file changes are recorded for this task.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {[...paths].map(path => (
            <li
              key={path}
              className="break-all font-mono text-[10px] text-[#a9c0ba]"
            >
              {path}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

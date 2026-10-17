import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Info,
  XCircle,
} from "lucide-react";
import type { TaskEvent } from "@/lib/studio-types";
import { phaseLabel, timeAgo } from "@/lib/studio-types";

const iconFor = (severity: string) =>
  severity === "success" ? (
    <CheckCircle2 size={14} className="text-[#7df2c5]" />
  ) : severity === "error" ? (
    <XCircle size={14} className="text-[#f87171]" />
  ) : severity === "warning" ? (
    <AlertTriangle size={14} className="text-[#f6c86e]" />
  ) : (
    <Info size={14} className="text-[#79a7b0]" />
  );

function safePaths(metadata: string | null) {
  if (!metadata) return [];
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!parsed || typeof parsed !== "object") return [];
    const values = parsed as Record<string, unknown>;
    const paths = [values.files, values.changed, values.relevantFiles]
      .filter(Array.isArray)
      .flatMap(value => value)
      .filter((value): value is string => typeof value === "string")
      .filter(value => !/(^|\/)\.env(?:\.|$)/i.test(value))
      .slice(0, 8);
    return [...new Set(paths)];
  } catch {
    return [];
  }
}

export default function ActivityTimeline({ events }: { events: TaskEvent[] }) {
  return (
    <section className="rounded-xl border border-[#1d3539] bg-[#0b1a20]">
      <div className="border-b border-[#182f35] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#58716f]">
          Activity timeline
        </div>
        <div className="mt-1 text-sm font-medium text-[#dcece8]">
          Recorded execution events
        </div>
      </div>
      <div className="studio-scroll max-h-[420px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[#627c79]">
            No execution events have been recorded for this task.
          </div>
        ) : (
          events.map(event => {
            const paths = safePaths(event.metadata);
            return (
              <details
                key={event.id}
                className="group border-b border-[#162b31] last:border-0"
              >
                <summary className="flex cursor-pointer list-none gap-3 px-5 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7df2c5]">
                  <div className="mt-0.5">{iconFor(event.severity)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[12px] leading-5 text-[#c9dcd7]">
                        {event.summary}
                      </span>
                      <time
                        className="shrink-0 text-[10px] text-[#55716e]"
                        dateTime={new Date(event.createdAt).toISOString()}
                        title={new Date(event.createdAt).toLocaleString()}
                      >
                        {timeAgo(event.createdAt)}
                      </time>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#57736f]">
                      <CircleDot size={9} />
                      {event.actor}
                      <span>·</span>
                      {phaseLabel(event.phase)}
                    </div>
                  </div>
                </summary>
                <div className="pb-3 pl-12 pr-5 text-[10px] leading-5 text-[#79918d]">
                  <div>
                    {event.eventType} ·{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                  {paths.length > 0 && (
                    <div className="mt-1 break-words">
                      Files: {paths.join(", ")}
                    </div>
                  )}
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}

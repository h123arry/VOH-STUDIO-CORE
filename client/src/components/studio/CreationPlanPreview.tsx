import {
  AlertTriangle,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const humanize = (value: string) => value.replace(/[-_]/g, " ");
const titleCase = (value: string) =>
  value.replace(/\b\w/g, character => character.toUpperCase());

export default function CreationPlanPreview({
  objective,
}: {
  objective: string;
}) {
  const [open, setOpen] = useState(false);
  const [planObjective, setPlanObjective] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPlanObjective(objective.trim()),
      350
    );
    return () => window.clearTimeout(timer);
  }, [objective]);

  const trimmedObjective = objective.trim();
  const planQuery = trpc.creation.plan.useQuery(
    { objective: planObjective || "Plan preview" },
    {
      enabled:
        open &&
        trimmedObjective.length >= 8 &&
        planObjective === trimmedObjective,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    }
  );
  const isUpdating =
    open && trimmedObjective.length >= 8 && planObjective !== trimmedObjective;

  return (
    <section className="plan-preview">
      <button
        type="button"
        className="plan-preview-toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="flex items-center gap-2">
          <Sparkles size={14} />
          Preview execution plan
        </span>
        <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div id="creation-plan-preview" className="plan-preview-content">
          {trimmedObjective.length < 8 ? (
            <p className="plan-preview-muted">
              Add at least 8 characters to preview how VOH will approach this
              task.
            </p>
          ) : isUpdating || planQuery.isLoading ? (
            <p className="plan-preview-muted" role="status">
              <LoaderCircle size={14} className="animate-spin" />
              Preparing a plan for this objective…
            </p>
          ) : planQuery.isError ? (
            <div className="plan-preview-error" role="alert">
              <span>
                Plan preview is unavailable: {planQuery.error.message}
              </span>
              <button
                type="button"
                onClick={() => planQuery.refetch()}
                aria-label="Retry plan preview"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          ) : planQuery.data ? (
            <>
              <div className="plan-preview-summary">
                <span className="plan-preview-mode">
                  {titleCase(planQuery.data.mode)}
                </span>
                <span>
                  Before you run, review the approach VOH inferred from your
                  objective.
                </span>
              </div>
              {planQuery.data.safety.approvalRequired && (
                <div className="plan-preview-warning" role="note">
                  <AlertTriangle size={14} />
                  <span>
                    Sensitive actions detected (
                    {planQuery.data.safety.protectedActions.join(", ")}). Review
                    the request carefully before running it.
                  </span>
                </div>
              )}
              <div className="plan-preview-grid">
                <div>
                  <h3>Capabilities</h3>
                  <div className="plan-preview-tags">
                    {planQuery.data.capabilityKeys.map(capability => (
                      <span key={capability}>
                        {titleCase(humanize(capability))}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Specialists</h3>
                  <div className="plan-preview-tags">
                    {planQuery.data.agents.map(agent => (
                      <span key={agent}>{titleCase(humanize(agent))}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="plan-preview-phases">
                <h3>Workflow</h3>
                <ol>
                  {planQuery.data.phases.map((phase, index) => (
                    <li key={`${phase}-${index}`}>{titleCase(phase)}</li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { ProjectDetail } from "@/lib/studio-types";

export default function WorkspaceRecoveryPanel({
  detail,
}: {
  detail?: ProjectDetail;
}) {
  const projectId = detail?.project.id;
  const snapshots = detail?.snapshots ?? [];
  const [snapshotId, setSnapshotId] = useState<number>();
  const utils = trpc.useUtils();
  useEffect(() => {
    if (snapshotId && snapshots.some(snapshot => snapshot.id === snapshotId))
      return;
    setSnapshotId(snapshots[0]?.id);
  }, [snapshotId, snapshots]);

  const comparison = trpc.projects.snapshots.compare.useQuery(
    { projectId: projectId ?? 0, snapshotId: snapshotId ?? 0 },
    {
      enabled: Boolean(projectId && snapshotId),
      refetchOnWindowFocus: false,
    }
  );
  const restore = trpc.projects.snapshots.restore.useMutation({
    onSuccess: async result => {
      if (!projectId) return;
      await Promise.all([
        utils.projects.get.invalidate({ projectId }),
        utils.workspace.tree.invalidate({ projectId }),
        utils.projects.snapshots.compare.invalidate({
          projectId,
          snapshotId: result.snapshotId,
        }),
      ]);
    },
  });

  const restoreSnapshot = () => {
    if (!projectId || !snapshotId || restore.isPending) return;
    const selected = snapshots.find(snapshot => snapshot.id === snapshotId);
    const confirmed = window.confirm(
      `Restore "${selected?.reason ?? "this checkpoint"}"? This replaces the entire current project workspace with the selected snapshot. This cannot be undone from the editor.`
    );
    if (confirmed) restore.mutate({ projectId, snapshotId, confirm: true });
  };

  return (
    <section className="workspace-recovery">
      <div className="workspace-recovery-heading">Workspace recovery</div>
      {snapshots.length === 0 ? (
        <p className="workspace-recovery-muted">
          A recovery point will be available after a build task creates one.
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor={`snapshot-${projectId}`}>
            Select a workspace snapshot
          </label>
          <select
            id={`snapshot-${projectId}`}
            value={snapshotId ?? ""}
            onChange={event => setSnapshotId(Number(event.target.value))}
          >
            {snapshots.map(snapshot => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.reason} ·{" "}
                {new Date(snapshot.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
          {comparison.isLoading ? (
            <p className="workspace-recovery-muted" role="status">
              Comparing workspace file lists…
            </p>
          ) : comparison.isError ? (
            <p className="workspace-recovery-error" role="alert">
              Could not compare snapshot: {comparison.error.message}
            </p>
          ) : comparison.data ? (
            <div className="workspace-recovery-diff">
              <div>
                {comparison.data.added.length} added ·{" "}
                {comparison.data.removed.length} missing now ·{" "}
                {comparison.data.unchangedCount} paths still present
              </div>
              {comparison.data.added.length > 0 && (
                <p>
                  Added since snapshot:{" "}
                  {comparison.data.added.slice(0, 8).join(", ")}
                </p>
              )}
              {comparison.data.removed.length > 0 && (
                <p>
                  Present in snapshot:{" "}
                  {comparison.data.removed.slice(0, 8).join(", ")}
                </p>
              )}
              <p className="workspace-recovery-muted">
                This compares file paths, not line-by-line contents. Restore is
                explicit and replaces the whole workspace.
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="workspace-recovery-restore"
            disabled={!snapshotId || restore.isPending}
            onClick={restoreSnapshot}
          >
            {restore.isPending ? "Restoring…" : "Restore this snapshot…"}
          </button>
          {restore.isError && (
            <p className="workspace-recovery-error" role="alert">
              Could not restore the snapshot: {restore.error.message}
            </p>
          )}
          {restore.isSuccess && (
            <p className="workspace-recovery-muted" role="status">
              Restored {restore.data.restoredFiles} files and refreshed the
              project index.
            </p>
          )}
        </>
      )}
    </section>
  );
}

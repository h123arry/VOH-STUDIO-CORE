import { useState } from "react";
import { GitBranch, GitCommitHorizontal, HeartPulse, Github, ShieldAlert, UploadCloud, Download, LoaderCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function LifecyclePanel({ projectId }: { projectId?: number }) {
  const enabled = Boolean(projectId);
  const utils = trpc.useUtils();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const git = trpc.lifecycle.git.status.useQuery({ projectId: projectId ?? 0 }, { enabled, retry: false, refetchOnWindowFocus: false });
  const health = trpc.lifecycle.deployment.health.useQuery({ projectId: projectId ?? 0 }, { enabled, refetchOnWindowFocus: false });
  const github = trpc.lifecycle.github.status.useQuery(undefined, { enabled: true, refetchOnWindowFocus: false });
  const init = trpc.lifecycle.git.init.useMutation({ onSuccess: () => git.refetch() });
  const clone = trpc.lifecycle.git.clone.useMutation({
    onSuccess: async () => {
      setRepositoryUrl("");
      await Promise.all([
        git.refetch(),
        utils.projects.get.invalidate({ projectId: projectId ?? 0 }),
        utils.repository.map.invalidate({ projectId: projectId ?? 0 }),
      ]);
    },
  });
  if (!projectId) return null;
  const healthTone = (health.data?.score ?? 0) >= 75 ? "text-[#7df2c5]" : (health.data?.score ?? 0) >= 50 ? "text-[#f2d27d]" : "text-[#f0a69c]";
  return <section className="mt-5 rounded-xl border border-[#1b3737] bg-[#0a181e] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#7df2c5]"><HeartPulse size={13} /> Lifecycle control</div><p className="mt-1 text-xs text-[#78908e]">Version, review, and release with evidence—not simulated status.</p></div>
      <div className="flex items-center gap-2 text-[10px] text-[#637e7a]"><Github size={13} /> {github.data?.enabled ? "GitHub connector connected" : "Public repository import available · private GitHub actions need a connector"}</div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-[#183238] bg-[#08141a] p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#64807b]"><GitBranch size={12} /> Repository</div>{git.data ? <><div className="mt-2 text-sm text-[#d5e9e3]">{git.data.branch}</div><div className="mt-1 truncate text-[10px] text-[#607b77]">{git.data.head ?? "No commit yet"}</div></> : <button onClick={() => init.mutate({ projectId })} disabled={init.isPending} className="mt-3 flex items-center gap-2 rounded-md bg-[#153533] px-3 py-2 text-[11px] font-semibold text-[#a7e7d1] hover:bg-[#1b4740] disabled:opacity-50"><GitCommitHorizontal size={13} /> {init.isPending ? "Initializing…" : "Initialize Git"}</button>}</div>
      <div className="rounded-lg border border-[#183238] bg-[#08141a] p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#64807b]"><ShieldAlert size={12} /> Project health</div><div className={`mt-2 text-2xl font-semibold ${healthTone}`}>{health.data?.score ?? "—"}<span className="ml-1 text-xs text-[#607b77]">/ 100</span></div><div className="mt-1 text-[10px] text-[#607b77]">{health.data?.actionable.length ?? 0} actionable findings</div></div>
      <div className="rounded-lg border border-[#183238] bg-[#08141a] p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.12em] text-[#64807b]"><UploadCloud size={12} /> Delivery posture</div><div className="mt-2 text-sm text-[#d5e9e3]">Preflight required</div><div className="mt-1 text-[10px] text-[#607b77]">Build · test · security · environment</div></div>
    </div>
    <form className="mt-3 rounded-lg border border-[#183238] bg-[#08141a] p-3" onSubmit={event => { event.preventDefault(); if (repositoryUrl.trim()) clone.mutate({ projectId, url: repositoryUrl.trim(), destination: "." }); }}>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#7d9b95]"><Download size={12} /> Import an existing repository</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="url" required value={repositoryUrl} onChange={event => setRepositoryUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="min-w-0 flex-1 rounded-md border border-[#254044] bg-[#071016] px-3 py-2 text-xs text-[#dcece8] outline-none placeholder:text-[#58716f] focus:border-[#638d84]" />
        <button type="submit" disabled={clone.isPending || !repositoryUrl.trim()} className="flex items-center justify-center gap-2 rounded-md bg-[#153533] px-4 py-2 text-xs font-semibold text-[#b5ead8] hover:bg-[#1b4740] disabled:cursor-not-allowed disabled:opacity-50">{clone.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Github size={13} />}{clone.isPending ? "Importing…" : "Import to workspace"}</button>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-[#617b77]">Public HTTPS repositories on GitHub, GitLab, and Bitbucket. Imports into an empty project workspace and indexes source files. Private repositories require an authenticated provider connection.</p>
      {clone.error && <p role="alert" className="mt-2 text-xs text-[#f0a69c]">{clone.error.message}</p>}
      {clone.data && <p className="mt-2 text-xs text-[#9bd9c5]">Imported successfully. {clone.data.indexedFiles} files indexed{clone.data.skippedLargeFiles ? `; ${clone.data.skippedLargeFiles} large files are available on disk but not loaded into the editor` : ""}.</p>}
    </form>
  </section>;
}

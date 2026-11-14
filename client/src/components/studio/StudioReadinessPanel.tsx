import { AlertCircle, CheckCircle2, CircleDashed, LoaderCircle, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const availableNow = [
  "Browser website and web-app source generation",
  "2D browser-game source generation",
  "Mobile PWA starters",
  "Public Git repository import",
  "Manual source editing and recovery",
  "Project ZIP export",
];
const infrastructureNeeded = [
  "Native Android and iOS builds",
  "Isolated project build, test, and terminal execution",
  "Live external deployment providers",
];

export default function StudioReadinessPanel() {
  const readiness = trpc.system.readiness.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  return <section className="rounded-xl border border-[#252525] bg-[#101010] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#888]"><ShieldCheck size={13} /> Studio readiness</div>
        <p className="mt-1 text-sm text-[#ddd]">Environment checks and honest capability boundaries</p>
      </div>
      {readiness.isLoading ? <span className="flex items-center gap-2 text-xs text-[#888]"><LoaderCircle size={13} className="animate-spin" /> Checking environment</span> :
        readiness.data?.ready ? <span className="flex items-center gap-2 text-xs text-[#9bd9c5]"><CheckCircle2 size={14} /> Workspace services ready</span> :
        <span className="flex items-center gap-2 text-xs text-[#e4c68a]"><AlertCircle size={14} /> Setup required</span>}
    </div>
    {readiness.error && <p role="alert" className="mt-3 text-xs text-[#e4a0a0]">{readiness.error.message}</p>}
    {readiness.data && <>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {readiness.data.checks.map(check => <div key={check.id} className="rounded-lg border border-[#292929] bg-[#0a0a0a] p-3">
          <div className="flex items-center gap-2 text-xs text-[#ddd]">
            {check.status === "ready" ? <CheckCircle2 size={13} className="text-[#9bd9c5]" /> : check.status === "unreachable" ? <AlertCircle size={13} className="text-[#e4a0a0]" /> : <CircleDashed size={13} className="text-[#e4c68a]" />}
            {check.label}
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#858585]">{check.detail}</p>
        </div>)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8dbaa8]">Available in this build</div>
          <ul className="space-y-1.5">{availableNow.map(item => <li key={item} className="flex items-center gap-2 text-[11px] text-[#b8c8c2]"><CheckCircle2 size={11} className="text-[#7fae9b]" />{item}</li>)}</ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#bca77d]">Needs more infrastructure</div>
          <ul className="space-y-1.5">{infrastructureNeeded.map(item => <li key={item} className="flex items-center gap-2 text-[11px] text-[#a59d8b]"><CircleDashed size={11} className="text-[#a58e63]" />{item}</li>)}</ul>
        </div>
      </div>
    </>}
  </section>;
}

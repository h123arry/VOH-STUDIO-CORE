import { useEffect, useState } from "react";
import { ExternalLink, FileCode2, FileJson2, FileText, Folder, GitBranch, TerminalSquare, Pencil, Save, X, LoaderCircle } from "lucide-react";
import type { ProjectDetail } from "@/lib/studio-types";
import { fileLanguage } from "@/lib/studio-types";
import { trpc } from "@/lib/trpc";

const iconFor = (path: string) =>
  path.endsWith(".json") ? <FileJson2 size={14} className="text-[#d7bf7d]" /> :
  path.endsWith(".md") ? <FileText size={14} className="text-[#8dbbd3]" /> :
  <FileCode2 size={14} className="text-[#7df2c5]" />;

export default function WorkspacePanel({ detail, selectedPath, onSelect }: {
  detail?: ProjectDetail;
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  const files = detail?.files ?? [];
  const selected = files.find(file => file.path === selectedPath) ?? files[0];
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveFile = trpc.workspace.writeFile.useMutation({
    onSuccess: async () => {
      setEditing(false);
      setSaved(true);
      await utils.projects.get.invalidate({ projectId: detail?.project.id ?? 0 });
    },
  });

  useEffect(() => {
    setDraft(selected?.content ?? "");
    setEditing(false);
    setSaved(false);
  }, [selected?.path, selected?.content]);

  const save = () => {
    if (!detail?.project || !selected || !editing) return;
    saveFile.mutate({ projectId: detail.project.id, path: selected.path, content: draft });
  };

  return <section className="overflow-hidden rounded-xl border border-[#1d3539] bg-[#0b1a20]">
    <div className="flex items-center justify-between border-b border-[#182f35] px-5 py-4">
      <div><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#58716f]">Workspace</div><div className="mt-1 text-sm font-medium text-[#dcece8]">Files and evidence</div></div>
      <div className="flex items-center gap-3 text-[10px] text-[#58716f]">
        {detail?.project && files.some(file => file.path === "index.html") && <a href={"/api/preview/" + detail.project.id + "/"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#7df2c5] hover:text-[#b2f8df]"><ExternalLink size={12} /> Preview</a>}
        <span className="flex items-center gap-2"><GitBranch size={13} /> persistent workspace</span>
      </div>
    </div>
    <div className="grid min-h-[320px] grid-cols-[190px_minmax(0,1fr)]">
      <div className="studio-scroll border-r border-[#182f35] p-3">
        <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#56706f]"><Folder size={12} /> root</div>
        {files.length === 0 ? <div className="px-2 py-3 text-xs leading-5 text-[#627c79]">No files recorded yet.</div> : files.map(file => <button key={file.id} onClick={() => { if (editing && draft !== (selected?.content ?? "") && !window.confirm("Discard unsaved changes?")) return; onSelect(file.path); }} className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs transition ${selected?.path === file.path ? "bg-[#122f31] text-[#e1f9f0]" : "text-[#78908e] hover:bg-[#10252b] hover:text-[#cde1dc]"}`}>{iconFor(file.path)}<span className="min-w-0 truncate">{file.path}</span></button>)}
      </div>
      <div className="min-w-0 bg-[#071016]">
        {selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#182f35] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-[#c9ded9]">{iconFor(selected.path)} {selected.path}<span className="font-mono text-[10px] text-[#55716f]">{fileLanguage(selected.path)} · {selected.size} B</span></div>
            <div className="flex items-center gap-2">
              {saved && <span role="status" className="text-[10px] text-[#9bd9c5]">Saved · recovery snapshot created</span>}
              {!editing ? <button type="button" onClick={() => { setSaved(false); setEditing(true); }} disabled={selected.content == null} className="flex items-center gap-1 rounded border border-[#254044] px-2 py-1.5 text-[10px] text-[#b8d5cc] hover:bg-[#10252b] disabled:opacity-40"><Pencil size={11} /> Edit</button> : <>
                <button type="button" onClick={() => { setDraft(selected.content ?? ""); setEditing(false); saveFile.reset(); }} disabled={saveFile.isPending} className="flex items-center gap-1 rounded border border-[#254044] px-2 py-1.5 text-[10px] text-[#b8d5cc] hover:bg-[#10252b]"><X size={11} /> Cancel</button>
                <button type="button" onClick={save} disabled={saveFile.isPending || draft === (selected.content ?? "")} className="flex items-center gap-1 rounded bg-[#7df2c5] px-2 py-1.5 text-[10px] font-semibold text-[#071016] hover:bg-[#a2f7d8] disabled:opacity-40">{saveFile.isPending ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />}{saveFile.isPending ? "Saving…" : "Save"}</button>
              </>}
            </div>
          </div>
          {editing ? <textarea aria-label={`Edit ${selected.path}`} spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} className="studio-scroll min-h-[320px] w-full resize-y bg-[#071016] p-4 font-mono text-[12px] leading-6 text-[#d4e5df] outline-none focus:ring-1 focus:ring-inset focus:ring-[#456e66]" /> : <pre className="studio-scroll max-h-[320px] overflow-auto p-4 text-[12px] leading-6 text-[#9fbab5]">{selected.content ?? "Content is indexed on disk and will be readable through the workspace endpoint."}</pre>}
          {saveFile.error && <p role="alert" className="border-t border-[#472d31] px-4 py-2 text-xs text-[#f0a69c]">{saveFile.error.message}</p>}
        </> : <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#58716f]"><TerminalSquare size={24} /><span className="text-xs">Workspace output will appear here.</span></div>}
      </div>
    </div>
  </section>;
}

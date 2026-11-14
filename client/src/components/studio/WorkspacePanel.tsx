import { useEffect, useState } from "react";
import { ExternalLink, Download, FileCode2, FileJson2, FileText, Folder, GitBranch, TerminalSquare, Pencil, Save, X, LoaderCircle, ShieldAlert, Plus, Check } from "lucide-react";
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
  const tree = trpc.workspace.tree.useQuery(
    { projectId: detail?.project.id ?? 0 },
    { enabled: Boolean(detail?.project.id), refetchOnWindowFocus: false }
  );
  const diskFiles = tree.data?.disk.filter(file => file.kind === "file") ?? [];
  const unindexedFiles = diskFiles.filter(file => !files.some(indexed => indexed.path === file.path));
  const selected = selectedPath ? files.find(file => file.path === selectedPath) : files[0];
  const selectedDisk = selectedPath
    ? diskFiles.find(file => file.path === selectedPath)
    : diskFiles.find(file => file.path === selected?.path) ?? diskFiles[0];
  const activePath = selected?.path ?? selectedDisk?.path;
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const saveFile = trpc.workspace.writeFile.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        utils.projects.get.invalidate({ projectId: detail?.project.id ?? 0 }),
        utils.workspace.tree.invalidate({ projectId: detail?.project.id ?? 0 }),
      ]);
      setSaved(true);
    },
  });
  const createFile = trpc.workspace.createFile.useMutation({
    onSuccess: async result => {
      setCreating(false);
      setNewFilePath("");
      await Promise.all([
        utils.projects.get.invalidate({ projectId: detail?.project.id ?? 0 }),
        utils.workspace.tree.invalidate({ projectId: detail?.project.id ?? 0 }),
      ]);
      onSelect(result.path);
    },
  });

  useEffect(() => {
    setDraft(selected?.content ?? "");
    setEditing(false);
    setSaved(false);
  }, [activePath, selected?.content]);

  const selectFile = (path: string) => {
    if (editing && draft !== (selected?.content ?? "") && !window.confirm("Discard unsaved changes?")) return;
    onSelect(path);
  };
  const save = () => {
    if (!detail?.project || !selected || !editing) return;
    saveFile.mutate({ projectId: detail.project.id, path: selected.path, content: draft });
  };

  return <section className="overflow-hidden rounded-xl border border-[#1d3539] bg-[#0b1a20]">
    <div className="flex items-center justify-between border-b border-[#182f35] px-5 py-4">
      <div><div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#58716f]">Workspace</div><div className="mt-1 text-sm font-medium text-[#dcece8]">Files and evidence</div></div>
      <div className="flex items-center gap-3 text-[10px] text-[#58716f]">
        {detail?.project && files.some(file => file.path === "index.html") && <a href={"/api/preview/" + detail.project.id + "/"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#7df2c5] hover:text-[#b2f8df]"><ExternalLink size={12} /> Preview</a>}
        {detail?.project && <a href={"/api/projects/" + detail.project.id + "/export.zip"} download className="flex items-center gap-1 text-[#9bb9b0] hover:text-[#d2e9df]"><Download size={12} /> Export ZIP</a>}
        <span className="flex items-center gap-2"><GitBranch size={13} /> persistent workspace</span>
      </div>
    </div>
    <div className="grid min-h-[320px] grid-cols-[190px_minmax(0,1fr)]">
      <div className="studio-scroll border-r border-[#182f35] p-3">
        <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#56706f]"><Folder size={12} /> root</div>
        <button type="button" onClick={() => { setCreating(value => !value); createFile.reset(); }} disabled={!detail?.project || createFile.isPending || saveFile.isPending} className="mb-2 flex w-full items-center gap-2 rounded border border-dashed border-[#254044] px-2 py-2 text-left text-[10px] text-[#9bb9b0] hover:bg-[#10252b]"><Plus size={12} /> New file</button>
        {creating && <form onSubmit={event => { event.preventDefault(); if (!detail?.project || !newFilePath.trim()) return; createFile.mutate({ projectId: detail.project.id, path: newFilePath.trim(), content: "" }); }} className="mb-3 space-y-2 rounded border border-[#254044] bg-[#08151a] p-2">
          <input autoFocus aria-label="New file path" value={newFilePath} onChange={event => setNewFilePath(event.target.value)} placeholder="src/new-file.ts" className="w-full rounded border border-[#254044] bg-[#071016] px-2 py-2 font-mono text-[10px] text-[#d4e5df] outline-none focus:border-[#7df2c5]" />
          <div className="flex gap-2">
            <button type="submit" disabled={!newFilePath.trim() || createFile.isPending} className="flex flex-1 items-center justify-center gap-1 rounded bg-[#7df2c5] px-2 py-1.5 text-[10px] font-semibold text-[#071016] disabled:opacity-40">{createFile.isPending ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />} Create</button>
            <button type="button" onClick={() => { setCreating(false); setNewFilePath(""); createFile.reset(); }} disabled={createFile.isPending} className="rounded border border-[#254044] px-2 py-1.5 text-[10px] text-[#b8d5cc]">Cancel</button>
          </div>
          {createFile.error && <p role="alert" className="text-[10px] leading-4 text-[#f0a69c]">{createFile.error.message}</p>}
        </form>}
        {files.map(file => <button key={file.id} onClick={() => selectFile(file.path)} disabled={saveFile.isPending} className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs transition ${activePath === file.path ? "bg-[#122f31] text-[#e1f9f0]" : "text-[#78908e] hover:bg-[#10252b] hover:text-[#cde1dc]"}`}>{iconFor(file.path)}<span className="min-w-0 truncate">{file.path}</span></button>)}
        {unindexedFiles.length > 0 && <>
          <div className="mb-2 mt-4 flex items-center gap-2 border-t border-[#182f35] px-2 pt-3 text-[9px] font-semibold uppercase tracking-[.12em] text-[#6c7773]"><ShieldAlert size={11} /> Not indexed</div>
          {unindexedFiles.map(file => <button key={file.path} onClick={() => selectFile(file.path)} disabled={saveFile.isPending} className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs transition ${activePath === file.path ? "bg-[#2b2920] text-[#f2e3b8]" : "text-[#8c8774] hover:bg-[#22221d]"}`}><FileText size={13} /><span className="min-w-0 flex-1 truncate">{file.path}</span><span className="shrink-0 font-mono text-[9px]">{file.size > 60_000 ? "large" : "protected"}</span></button>)}
        </>}
        {files.length === 0 && unindexedFiles.length === 0 && <div className="px-2 py-3 text-xs leading-5 text-[#627c79]">{tree.isLoading ? "Loading workspace files…" : "No files recorded yet."}</div>}
      </div>
      <div className="min-w-0 bg-[#071016]">
        {selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#182f35] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-[#c9ded9]">{iconFor(selected.path)} {selected.path}<span className="font-mono text-[10px] text-[#55716f]">{fileLanguage(selected.path)} · {selected.size} B</span>{editing && draft !== (selected.content ?? "") && <span role="status" className="rounded border border-[#6b5830] px-1.5 py-0.5 text-[9px] text-[#e6c982]">Unsaved changes</span>}</div>
            <div className="flex items-center gap-2">
              {saved && <span role="status" className="text-[10px] text-[#9bd9c5]">Saved · recovery snapshot created</span>}
              {!editing ? <button type="button" onClick={() => { setSaved(false); setEditing(true); }} disabled={selected.content == null} className="flex items-center gap-1 rounded border border-[#254044] px-2 py-1.5 text-[10px] text-[#b8d5cc] hover:bg-[#10252b] disabled:opacity-40"><Pencil size={11} /> Edit</button> : <>
                <button type="button" onClick={() => { setDraft(selected.content ?? ""); setEditing(false); saveFile.reset(); }} disabled={saveFile.isPending} className="flex items-center gap-1 rounded border border-[#254044] px-2 py-1.5 text-[10px] text-[#b8d5cc] hover:bg-[#10252b]"><X size={11} /> Cancel</button>
                <button type="button" onClick={save} disabled={saveFile.isPending || draft === (selected.content ?? "")} title="Save changes (Ctrl/⌘ + S)" className="flex items-center gap-1 rounded bg-[#7df2c5] px-2 py-1.5 text-[10px] font-semibold text-[#071016] hover:bg-[#a2f7d8] disabled:opacity-40">{saveFile.isPending ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />}{saveFile.isPending ? "Saving…" : "Save"}</button>
              </>}
            </div>
          </div>
          {editing ? <><textarea aria-label={`Edit ${selected.path}`} spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); } }} className="studio-scroll min-h-[320px] w-full resize-y bg-[#071016] p-4 font-mono text-[12px] leading-6 text-[#d4e5df] outline-none focus:ring-1 focus:ring-inset focus:ring-[#456e66]" /><div className="border-t border-[#182f35] px-4 py-1.5 text-[9px] text-[#55716f]">Tip: press Ctrl + S or ⌘ + S to save</div></> : <pre className="studio-scroll max-h-[320px] overflow-auto p-4 text-[12px] leading-6 text-[#9fbab5]">{selected.content ?? "Content is indexed on disk and will be readable through the workspace endpoint."}</pre>}
          {saveFile.error && <p role="alert" className="border-t border-[#472d31] px-4 py-2 text-xs text-[#f0a69c]">{saveFile.error.message}</p>}
        </> : selectedDisk ? <div className="p-5"><div className="flex items-center gap-2 text-sm text-[#e0d6b6]"><ShieldAlert size={15} /> {selectedDisk.path}</div><p className="mt-3 text-xs leading-6 text-[#8d8876]">This file is present in the project workspace but is not loaded into the editor index. Large files and files that may contain credentials or private material are intentionally excluded. Use the project's own tooling to manage this file.</p><div className="mt-2 font-mono text-[10px] text-[#6e6b5f]">{selectedDisk.size.toLocaleString()} bytes · read-only in Studio</div></div> : <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[#58716f]"><TerminalSquare size={24} /><span className="text-xs">Workspace output will appear here.</span></div>}
      </div>
    </div>
  </section>;
}

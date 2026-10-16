import {
  ArrowUp,
  ChevronDown,
  FilePlus2,
  ImagePlus,
  LoaderCircle,
  Paperclip,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Project } from "@/lib/studio-types";
import CreationPlanPreview from "@/components/studio/CreationPlanPreview";

const creationSuggestions = [
  "Build an app",
  "Create a website",
  "Create a game",
  "Fix my project",
  "Analyze my code",
  "Start from GitHub",
];

export default function TaskComposer({
  project,
  onSubmit,
  onCreateProject,
  pending,
}: {
  project?: Project;
  onSubmit: (objective: string, viewMode: "simple" | "developer") => void;
  onCreateProject: () => void;
  pending: boolean;
}) {
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<"simple" | "developer">("simple");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const suggestions = project
    ? [
        `Continue working on ${project.name}`,
        `Improve ${project.name}`,
        `Fix ${project.name}`,
        "Review recent changes",
        "Make it faster",
      ]
    : creationSuggestions;

  const submit = () => {
    if (!objective.trim() || pending) return;
    const attached = attachments.length
      ? `\n\nAttached context: ${attachments.map(file => file.name).join(", ")}`
      : "";
    onSubmit(`${objective.trim()}${attached}`, mode);
    setObjective("");
    setAttachments([]);
  };

  const addFiles = (files: FileList | null) => {
    if (files)
      setAttachments(current => [
        ...current,
        ...Array.from(files).slice(0, 5 - current.length),
      ]);
  };

  return (
    <section className="automation-hero">
      <div className="mx-auto max-w-[780px] text-center">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[.22em] text-[#888]">
          {project ? "Continue working" : "Your intelligent workspace"}
        </div>
        <h2 className="text-[30px] font-semibold tracking-[-.04em] text-[#f4f4f4] sm:text-[38px]">
          {project
            ? "What do you want to change?"
            : "What do you want to build or do?"}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#858585]">
          Describe the outcome in your own words. VOH organizes the plan, work,
          and evidence around it.
        </p>
        <div className="mt-7 rounded-2xl border border-[#303030] bg-[#151515] p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.18)] transition-colors focus-within:border-[#666]">
          <textarea
            value={objective}
            onChange={event => setObjective(event.target.value)}
            onKeyDown={event => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                submit();
            }}
            rows={4}
            placeholder={
              project
                ? "What should VOH change?"
                : "What do you want to build or automate?"
            }
            className="w-full resize-none bg-transparent px-3 py-2 text-[16px] leading-7 text-[#f2f2f2] outline-none placeholder:text-[#666]"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#292929] px-2 pt-3">
              {attachments.map((file, index) => (
                <span key={`${file.name}-${index}`} className="attachment-chip">
                  <Paperclip size={12} />
                  {file.name}
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#292929] px-2 pt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => {
                  addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="tool-button"
                onClick={() => fileRef.current?.click()}
                title="Attach files"
              >
                <Paperclip size={15} />
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => fileRef.current?.click()}
                title="Add image or screenshot"
              >
                <ImagePlus size={15} />
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => fileRef.current?.click()}
                title="Add project file"
              >
                <FilePlus2 size={15} />
              </button>
              <button
                type="button"
                className="mode-button"
                onClick={() =>
                  setMode(mode === "simple" ? "developer" : "simple")
                }
              >
                {mode === "simple" ? "Simple" : "Advanced"}
                <ChevronDown size={13} />
              </button>
            </div>
            <button
              type="button"
              disabled={!objective.trim() || pending}
              onClick={submit}
              className="primary-action"
            >
              {pending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <ArrowUp size={15} />
              )}
              {pending ? "Working" : "Run"}
            </button>
          </div>
        </div>
        <CreationPlanPreview objective={objective} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setObjective(suggestion)}
              className="suggestion-chip"
            >
              <Sparkles size={12} />
              {suggestion}
            </button>
          ))}
        </div>
        {!project && (
          <button
            type="button"
            onClick={onCreateProject}
            className="mt-5 inline-flex items-center gap-2 text-xs text-[#777] transition hover:text-[#eee]"
          >
            <Plus size={13} />
            Or create a named workspace first
          </button>
        )}
      </div>
    </section>
  );
}

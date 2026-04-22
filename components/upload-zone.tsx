"use client";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, X } from "lucide-react";

interface Props {
  /** Called when a file is picked — parent decides when to process it. */
  onSelect: (f: File) => void;
  /** Currently-selected file, if any. Drives the preview state. */
  selected: File | null;
  /** Parent callback to clear the current selection. */
  onClear: () => void;
  /** Disable interaction while the pipeline is running. */
  disabled?: boolean;
}

export function UploadZone({ onSelect, selected, onClear, disabled }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onSelect(accepted[0]);
    },
    [onSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled,
  });

  // Preview state — show the chosen file instead of the drop zone so the
  // user can confirm before hitting Submit.
  if (selected) {
    return (
      <div className="rounded-2xl border-2 border-slate-300 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-accent">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{selected.name}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {(selected.size / 1024).toFixed(1)} KB · PDF · ready to submit
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label="Clear selected file"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
          : isDragActive
            ? "border-accent bg-blue-50"
            : "border-slate-300 bg-white hover:border-accent hover:bg-slate-50"
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto h-10 w-10 text-accent" />
      <p className="mt-4 text-lg font-semibold text-ink">
        {isDragActive ? "Drop it here" : "Upload a PDF to decode"}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Lab report, rent agreement, insurance policy, govt notice — anything.
      </p>
    </div>
  );
}

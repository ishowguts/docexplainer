"use client";
import { Check, Languages } from "lucide-react";
import { LANGUAGE_LABELS, type LanguageCode } from "@/lib/types";

interface Props {
  value: LanguageCode[];
  onChange: (next: LanguageCode[]) => void;
}

// English is the baseline — always included in the output, never a toggle.
// These are the translations the user can optionally request.
const OPTIONAL: Array<{ code: Exclude<LanguageCode, "en">; hint: string }> = [
  { code: "hi", hint: "Bhashini" },
  { code: "hinglish", hint: "Gemini · Roman script" },
  { code: "bn", hint: "Bhashini" },
];

export function LanguagePicker({ value, onChange }: Props) {
  function toggle(code: Exclude<LanguageCode, "en">) {
    if (value.includes(code)) {
      onChange(value.filter((v) => v !== code));
    } else {
      onChange([...value, code]);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Languages className="h-3.5 w-3.5" />
        Output language
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* English pill — baseline, always on, not a toggle */}
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-ink">
          <Check className="h-3.5 w-3.5 text-slate-500" />
          English
          <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            default
          </span>
        </span>

        {/* Optional language toggles */}
        {OPTIONAL.map(({ code, hint }) => {
          const active = value.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition " +
                (active
                  ? "border-accent bg-accent text-white"
                  : "border-slate-300 bg-white text-ink hover:border-accent hover:text-accent")
              }
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {LANGUAGE_LABELS[code].native}
              <span
                className={
                  "ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                  (active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")
                }
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>


    </div>
  );
}

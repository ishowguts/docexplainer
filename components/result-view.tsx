"use client";
import { useMemo, useState } from "react";
import type { LanguageCode, PipelineResult, TranslatedView } from "@/lib/types";
import { LANGUAGE_LABELS } from "@/lib/types";
import { RiskFlagChip } from "./risk-flag";
import { Clock, Layers, Plus, Loader2 } from "lucide-react";

const domainLabel: Record<string, string> = {
  medical: "Medical",
  legal: "Legal",
  financial: "Financial",
  government: "Government",
  generic: "General",
};

// Every language the UI can offer after the result arrives. "en" is always
// the source so it's never added. Kept here rather than imported so this
// component doesn't reach across for config.
const ALL_TARGET_LANGS: Exclude<LanguageCode, "en">[] = ["hi", "hinglish", "bn"];

interface Props {
  result: PipelineResult;
  /**
   * Called when the user asks to add a new translation post-result.
   * Parent hits /api/translate and merges the new view into result.data.
   */
  onAddLanguage?: (lang: LanguageCode) => void;
  /** Which language is currently being fetched, if any (drives the spinner). */
  addingLang?: LanguageCode | null;
  /** Which language tab to show by default when results first load. */
  initialLang?: LanguageCode;
}

export function ResultView({ result, onAddLanguage, addingLang, initialLang = "en" }: Props) {
  const d = result.data;

  // Available language tabs: English (the ExplainedDoc itself) + whichever
  // translations came back successfully.
  const availableLangs = useMemo<LanguageCode[]>(() => {
    const translated = Object.keys(d.translations ?? {}) as LanguageCode[];
    return ["en", ...translated];
  }, [d.translations]);

  // Languages the user could *still* add (i.e. not already translated).
  const addableLangs = useMemo<Exclude<LanguageCode, "en">[]>(() => {
    return ALL_TARGET_LANGS.filter((l) => !availableLangs.includes(l));
  }, [availableLangs]);

  // Default to the language the user selected before submitting, as long as
  // it actually came back in the translations. Fall back to English otherwise.
  const [lang, setLang] = useState<LanguageCode>(
    availableLangs.includes(initialLang) ? initialLang : "en",
  );

  // Resolve the view for the selected language. Fall back to English if the
  // requested translation is missing for any reason.
  const englishView: TranslatedView = {
    title: d.title,
    summary: d.summary,
    keyTerms: d.keyTerms,
    riskFlags: d.riskFlags,
    actionItems: d.actionItems,
  };
  const view: TranslatedView =
    lang === "en"
      ? englishView
      : (d.translations?.[lang as Exclude<LanguageCode, "en">] ?? englishView);

  return (
    <section className="mt-10 space-y-6">
      {/* Header strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {domainLabel[d.domain] ?? d.domain}
          </span>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            {view.title}
          </h2>
        </div>

        {/* Language tabs — show only if more than one language is available */}
        {availableLangs.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {availableLangs.map((code) => {
              const active = code === lang;
              return (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={
                    "rounded-md px-3 py-1.5 text-sm font-medium transition " +
                    (active
                      ? "bg-white text-ink shadow-sm"
                      : "text-slate-500 hover:text-ink")
                  }
                >
                  {LANGUAGE_LABELS[code].native}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pipeline telemetry — the Dev+API differentiator */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> parse {result.meta.parseMs}ms · explain{" "}
          {result.meta.explainMs}ms · translate {result.meta.translateMs}ms
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" /> total {result.meta.totalMs}ms
        </span>
        {result.meta.languagesTranslated?.length > 0 && (
          <span className="rounded bg-slate-100 px-2 py-0.5">
            langs: {result.meta.languagesTranslated.join(", ")}
          </span>
        )}
        {result.meta.fallbacksUsed.length > 0 && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            fallback: {result.meta.fallbacksUsed.join(", ")}
          </span>
        )}
      </div>

      {/* Post-result "+ Add language" row — only if there are still langs to add
          AND the parent wired the callback. Pressing a chip hits /api/translate
          without re-uploading the PDF. */}
      {onAddLanguage && addableLangs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Translate to
          </span>
          {addableLangs.map((code) => {
            const busy = addingLang === code;
            const anyBusy = Boolean(addingLang);
            return (
              <button
                key={code}
                type="button"
                disabled={anyBusy}
                onClick={() => onAddLanguage(code)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-ink transition " +
                  "hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {LANGUAGE_LABELS[code].native}
                {busy && (
                  <span className="text-xs text-slate-500">translating…</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Summary
        </h3>
        <p className="mt-2 text-base leading-relaxed text-ink">{view.summary}</p>
      </div>

      {/* Risk flags */}
      {view.riskFlags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Risk flags ({view.riskFlags.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {view.riskFlags.map((f, i) => (
              <RiskFlagChip key={i} level={f.level} clause={f.clause} reason={f.reason} />
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {view.actionItems.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            What you should do
          </h3>
          <ul className="mt-3 space-y-2">
            {view.actionItems.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                    a.priority === "now"
                      ? "bg-red-500"
                      : a.priority === "soon"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                <span className="text-sm text-ink">
                  <span className="font-semibold capitalize">{a.priority}:</span> {a.action}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key terms glossary */}
      {view.keyTerms.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Glossary
          </h3>
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {view.keyTerms.map((t, i) => (
              <div key={i}>
                <dt className="font-semibold text-ink">{t.term}</dt>
                <dd className="text-sm text-slate-600">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

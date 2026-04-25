"use client";
import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ResultView } from "@/components/result-view";
import { LanguagePicker } from "@/components/language-picker";
import type { LanguageCode, PipelineResult } from "@/lib/types";
import { FileText, Stethoscope, Scale, Building2, Sparkles } from "lucide-react";

type Status =
  | "idle"
  | "uploading"
  | "parsing"
  | "explaining"
  | "translating"
  | "done"
  | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  uploading: "Uploading PDF…",
  parsing: "Extracting text…",
  explaining: "Asking Gemini for a plain-language breakdown…",
  translating: "Translating via Bhashini…",
  done: "Done",
  error: "Something went wrong",
};

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  // File is held in state after selection — user submits explicitly via the
  // Submit button rather than having the pipeline fire on drop.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // English is always the default view. User can opt-in to extra languages
  // before submit, or add more after the result comes back.
  const [targetLangs, setTargetLangs] = useState<LanguageCode[]>([]);

  // Per-language loading state for the post-result "+ Add language" button.
  const [addingLang, setAddingLang] = useState<LanguageCode | null>(null);

  const isBusy =
    status === "uploading" ||
    status === "parsing" ||
    status === "explaining" ||
    status === "translating";

  function clearForNewUpload() {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  }

  async function handleSubmit() {
    if (!selectedFile || isBusy) return;
    setResult(null);
    setError(null);
    setStatus("uploading");

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("languages", JSON.stringify(targetLangs));

      setStatus("parsing");
      const res = await fetch("/api/pipeline", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Pipeline failed");

      setStatus("done");
      setResult(json);
    } catch (e: any) {
      setStatus("error");
      setError("We are experiencing high demand. Please try again in a moment.");
    }
  }

  /**
   * Called from ResultView when the user clicks "+ Add language". Posts to
   * /api/translate with the current ExplainedDoc + the new language, then
   * merges the returned translation into the existing result in place —
   * no re-upload required.
   */
  async function handleAddLanguage(lang: LanguageCode) {
    if (!result || addingLang) return;
    if (lang === "en") return;
    if (result.data.translations?.[lang]) return; // already present

    setAddingLang(lang);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: {
            domain: result.data.domain,
            title: result.data.title,
            summary: result.data.summary,
            keyTerms: result.data.keyTerms,
            riskFlags: result.data.riskFlags,
            actionItems: result.data.actionItems,
            sourceLength: result.data.sourceLength,
          },
          languages: [lang],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Translation failed");

      // Merge the new translation into the existing result without
      // wiping the others that are already there.
      const newTranslations = {
        ...(result.data.translations ?? {}),
        ...(json.translated?.translations ?? {}),
      };
      setResult({
        ...result,
        data: { ...result.data, translations: newTranslations },
        meta: {
          ...result.meta,
          fallbacksUsed: [
            ...result.meta.fallbacksUsed,
            ...(json.fallbacks ?? []),
          ],
          languagesTranslated: Array.from(
            new Set([...result.meta.languagesTranslated, lang]),
          ),
        },
      });
    } catch (e: any) {
      setError("We are experiencing high demand. Please try again in a moment.");
    } finally {
      setAddingLang(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-grid border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">

          <h1 className="mt-5 font-display text-5xl font-semibold text-ink sm:text-6xl">
            DocExplainer
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Upload any medical, legal, financial, or government document.
            Get a plain-English breakdown — with risks flagged, key terms defined,
            and next steps listed. Add a translation in the language you&apos;re
            most comfortable with.
          </p>

          {/* Language picker — English is the baseline; add any of the extras */}
          <div className="mt-8">
            <LanguagePicker value={targetLangs} onChange={setTargetLangs} />
          </div>

          <div className="mt-8 text-left">
            <UploadZone
              onSelect={(f) => {
                setSelectedFile(f);
                setError(null);
              }}
              selected={selectedFile}
              onClear={clearForNewUpload}
              disabled={isBusy}
            />
          </div>

          {/* Submit / Change-file controls. Only rendered once a file exists. */}
          {selectedFile && (
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {isBusy ? "Processing…" : "Submit for analysis"}
              </button>
              <button
                type="button"
                onClick={clearForNewUpload}
                disabled={isBusy}
                className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-50"
              >
                Change file
              </button>
            </div>
          )}

          {status !== "idle" && status !== "done" && status !== "error" && (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 shadow-sm">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-sm text-slate-700">{STATUS_LABEL[status]}</span>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-left text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Supported domains */}
      {!result && status === "idle" && (
        <section className="mx-auto max-w-5xl px-6 py-12">

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Stethoscope, label: "Medical", desc: "Lab reports, prescriptions, discharge summaries" },
              { icon: Scale, label: "Legal", desc: "Rent agreements, contracts, consumer notices" },
              { icon: FileText, label: "Financial", desc: "Loan papers, EMIs, insurance policies" },
              { icon: Building2, label: "Government", desc: "RTI replies, scheme forms, notices" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold text-ink">{label}</h3>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {result && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <ResultView
            result={result}
            onAddLanguage={handleAddLanguage}
            addingLang={addingLang}
            initialLang={targetLangs.length > 0 ? targetLangs[0] : "en"}
          />
        </section>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-slate-500">
          DocExplainer · BTP Minor Project · Bittu Mandal · Mis - 112415048
        </div>
      </footer>
    </main>
  );
}

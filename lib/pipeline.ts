// ---------------------------------------------------------------------------
//  The orchestration pipeline.
//  Chains: parsePdf → classifyDomain (safety gate) → explainDocument → translateDoc
//  Captures per-hop latency and fallbacks used so the UI can show the user
//  exactly which APIs were hit and how long each took — the single feature
//  that makes this a "Development + API" project rather than a prompt wrapper.
// ---------------------------------------------------------------------------

import { parsePdf } from "./pdf";
import { explainDocument } from "./gemini";
import { translateDoc } from "./bhashini";
import { classifyDomain } from "./domain-templates";
import type { LanguageCode, PipelineMetadata, PipelineResult } from "./types";

export interface RunPipelineOptions {
  /** Target languages to translate into. English is always included implicitly. */
  languages?: LanguageCode[];
}

/**
 * Thrown when the uploaded PDF doesn't look like any of the four supported
 * domains. The API route catches this and returns a 422 with a friendly
 * message so the UI can show a domain-mismatch notice rather than a crash.
 */
export class UnsupportedDomainError extends Error {
  readonly code = "UNSUPPORTED_DOMAIN";
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedDomainError";
  }
}

export async function runPipeline(
  buffer: Buffer,
  opts: RunPipelineOptions = {},
): Promise<PipelineResult> {
  const fallbacks: string[] = [];
  const start = Date.now();

  // Normalize language list. Always include "en" as the source view.
  const languages: LanguageCode[] = Array.from(
    new Set<LanguageCode>(["en", ...(opts.languages ?? [])]),
  );

  // Hop 1 — parse
  const t0 = Date.now();
  const parsed = await parsePdf(buffer);
  const parseMs = Date.now() - t0;

  if (parsed.isScanned) {
    fallbacks.push("scanned-pdf→ocr-recommended");
  }
  if (!parsed.text) {
    throw new Error(
      "Could not extract text from PDF. Document may be image-only — OCR pass required.",
    );
  }

  // Safety gate — bail out if the document doesn't match any of the four
  // supported domains. Without this check, something like an OS lab report
  // or a novel would still be summarised (as "generic"), which defeats the
  // whole point of this tool being specialized and trustworthy.
  const domain = classifyDomain(parsed.text);
  if (domain === "generic") {
    throw new UnsupportedDomainError(
      "This document doesn't look like a medical, legal, financial, or " +
        "government document. DocExplainer is specialised for those four " +
        "domains only — academic notes, assignments, general articles, and " +
        "technical manuals won't get useful output. Try a lab report, rent " +
        "agreement, loan paper, insurance policy, or government notice.",
    );
  }

  // Hop 2 — explain
  const t1 = Date.now();
  const explained = await explainDocument(parsed.text, fallbacks);
  const explainMs = Date.now() - t1;

  // Hop 3 — translate into every non-English target
  const t2 = Date.now();
  const translationTargets = languages.filter((l) => l !== "en");
  const { translated, fallbacks: trFallbacks } = await translateDoc(
    explained,
    translationTargets,
  );
  const translateMs = Date.now() - t2;
  fallbacks.push(...trFallbacks);

  const meta: PipelineMetadata = {
    parseMs,
    explainMs,
    translateMs,
    totalMs: Date.now() - start,
    fallbacksUsed: fallbacks,
    languagesTranslated: languages,
  };

  return { data: translated, meta };
}

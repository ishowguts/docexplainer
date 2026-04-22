// ---------------------------------------------------------------------------
//  Shared type contracts for the DocExplainer API-orchestration pipeline.
//  These are the JSON shapes that flow between every API hop — they are the
//  "schema" in "schema-validated pipeline".
// ---------------------------------------------------------------------------

export type Domain = "medical" | "legal" | "financial" | "government" | "generic";

export type RiskLevel = "high" | "medium" | "low";

// Supported UI languages. "en" is always the source; the rest are optional
// translation targets. Adding a new language = 1 entry here + 1 mapping in
// bhashini.ts. The rest of the UI auto-renders tabs.
export type LanguageCode = "en" | "hi" | "hinglish" | "bn";

export const LANGUAGE_LABELS: Record<LanguageCode, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  hi: { native: "हिंदी", english: "Hindi" },
  hinglish: { native: "Hinglish", english: "Hinglish" },
  bn: { native: "বাংলা", english: "Bengali" },
};

export interface KeyTerm {
  term: string;
  meaning: string;
}

export interface RiskFlag {
  level: RiskLevel;
  clause: string;   // snippet of original text
  reason: string;   // why it's flagged
}

export interface ActionItem {
  action: string;
  priority: "now" | "soon" | "later";
}

// The "viewable" payload in a single language. The English version is the
// ExplainedDoc itself; every other language is a TranslatedView of the same
// shape.
export interface TranslatedView {
  title: string;
  summary: string;
  keyTerms: KeyTerm[];
  riskFlags: RiskFlag[];
  actionItems: ActionItem[];
}

export interface ExplainedDoc {
  domain: Domain;
  title: string;
  summary: string;        // 2-3 sentence plain-English TL;DR
  keyTerms: KeyTerm[];
  riskFlags: RiskFlag[];
  actionItems: ActionItem[];
  sourceLength: number;   // character count of original text
}

// Document + all requested translations. Keyed by language code (sans "en" —
// the English view is the ExplainedDoc itself).
export interface TranslatedDoc extends ExplainedDoc {
  translations: Partial<Record<Exclude<LanguageCode, "en">, TranslatedView>>;
}

export interface PipelineMetadata {
  parseMs: number;
  explainMs: number;
  translateMs: number;
  totalMs: number;
  fallbacksUsed: string[];
  languagesTranslated: LanguageCode[];
}

export interface PipelineResult {
  data: TranslatedDoc;
  meta: PipelineMetadata;
}

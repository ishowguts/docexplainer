// ---------------------------------------------------------------------------
//  Translation adapter (Hop 3 of the orchestration pipeline).
//
//  Supports multiple target languages through two back-ends:
//    - Bhashini  (hi, bn)       — Govt-of-India neural translation API
//    - Gemini    (hinglish, fallback for hi/bn if Bhashini creds missing)
//
//  The UI can request any subset of target languages. We translate each
//  field of the ExplainedDoc in parallel to keep latency low, and emit a
//  fallback-trail so PipelineMetadata can surface degraded paths.
//
//  All Gemini calls go through the shared key-rotating client in
//  lib/gemini-client.ts — if one API key hits its daily cap, the next
//  key in the list takes over transparently.
// ---------------------------------------------------------------------------

import { callGemini, GEMINI_TRANSLATE_CHAIN } from "./gemini-client";
import type {
  ExplainedDoc,
  LanguageCode,
  TranslatedDoc,
  TranslatedView,
} from "./types";

const BHASHINI_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";

// Languages that Bhashini can handle directly. "hinglish" is not a real ISO
// language — we always route it through Gemini.
const BHASHINI_LANGS: Record<string, string> = {
  hi: "hi",
  bn: "bn",
};

// Per-language prompt for the Gemini translation path. Keeping these separate
// lets us tailor tone for each target (natural Hindi vs. casual Hinglish).
const GEMINI_TRANSLATE_PROMPT: Record<Exclude<LanguageCode, "en">, string> = {
  hi:
    "Translate the following English text to natural, conversational Hindi in " +
    "Devanagari script. Explain medical/legal jargon in simple words rather " +
    "than transliterating. Respond with Hindi text only, no preamble.",
  hinglish:
    "Translate the following English text into Hinglish — everyday Indian " +
    "urban speech that mixes Hindi and English, written in Roman script. " +
    "Keep common English words (doctor, report, contract, deposit) as-is. " +
    "Be casual and conversational, like explaining to a friend over chai. " +
    "Respond with Hinglish only, no preamble.",
  bn:
    "Translate the following English text to natural, conversational Bengali " +
    "in Bengali script. Explain medical/legal jargon in simple words rather " +
    "than transliterating. Respond with Bengali text only, no preamble.",
};

type TranslateFn = (text: string) => Promise<string>;

function hasBhashini(): boolean {
  return Boolean(process.env.BHASHINI_API_KEY && process.env.BHASHINI_USER_ID);
}

// ---- Bhashini path --------------------------------------------------------

async function bhashiniTranslate(text: string, targetLang: string): Promise<string> {
  const res = await fetch(BHASHINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.BHASHINI_API_KEY!,
      userID: process.env.BHASHINI_USER_ID!,
    },
    body: JSON.stringify({
      pipelineTasks: [
        {
          taskType: "translation",
          config: { language: { sourceLanguage: "en", targetLanguage: targetLang } },
        },
      ],
      inputData: { input: [{ source: text }] },
    }),
  });

  if (!res.ok) throw new Error(`Bhashini responded ${res.status}`);
  const json: any = await res.json();
  return json?.pipelineResponse?.[0]?.output?.[0]?.target ?? text;
}

// ---- Gemini path ----------------------------------------------------------

async function geminiTranslate(
  text: string,
  lang: Exclude<LanguageCode, "en">,
  trace?: string[],
): Promise<string> {
  const raw = await callGemini(
    `${GEMINI_TRANSLATE_PROMPT[lang]}\n\n${text}`,
    { modelChain: GEMINI_TRANSLATE_CHAIN, trace },
  );
  return raw.trim();
}

// ---- Translator factory ---------------------------------------------------

/**
 * Build a `translate(text)` function for one target language, plus a human
 * label describing which back-end it uses (for the fallbacksUsed metadata).
 */
function translatorFor(
  lang: Exclude<LanguageCode, "en">,
  trace: string[],
): {
  fn: TranslateFn;
  route: string;
} {
  // Hinglish is always Gemini — Bhashini has no Hinglish model.
  if (lang === "hinglish") {
    return { fn: (t) => geminiTranslate(t, lang, trace), route: "gemini:hinglish" };
  }

  // For hi/bn, prefer Bhashini; fall back to Gemini if no creds.
  const bhashCode = BHASHINI_LANGS[lang];
  if (bhashCode && hasBhashini()) {
    return { fn: (t) => bhashiniTranslate(t, bhashCode), route: `bhashini:${lang}` };
  }
  return {
    fn: (t) => geminiTranslate(t, lang, trace),
    route: `gemini:${lang} (bhashini→gemini)`,
  };
}

// ---- Translate one view ---------------------------------------------------

async function translateView(
  doc: ExplainedDoc,
  translate: TranslateFn,
): Promise<TranslatedView> {
  const [title, summary, keyTerms, riskFlags, actionItems] = await Promise.all([
    translate(doc.title),
    translate(doc.summary),
    Promise.all(
      doc.keyTerms.map(async (t) => ({
        term: await translate(t.term),
        meaning: await translate(t.meaning),
      })),
    ),
    Promise.all(
      doc.riskFlags.map(async (f) => ({
        level: f.level,
        clause: await translate(f.clause),
        reason: await translate(f.reason),
      })),
    ),
    Promise.all(
      doc.actionItems.map(async (a) => ({
        action: await translate(a.action),
        priority: a.priority,
      })),
    ),
  ]);
  return { title, summary, keyTerms, riskFlags, actionItems };
}

// ---- Public entry point ---------------------------------------------------

export async function translateDoc(
  doc: ExplainedDoc,
  targets: LanguageCode[],
): Promise<{ translated: TranslatedDoc; fallbacks: string[] }> {
  const fallbacks: string[] = [];
  const translations: TranslatedDoc["translations"] = {};

  // Filter out "en" (it's the source) and dedupe.
  const wanted = Array.from(new Set(targets.filter((l): l is Exclude<LanguageCode, "en"> => l !== "en")));

  // Translate each target language in parallel.
  await Promise.all(
    wanted.map(async (lang) => {
      const { fn, route } = translatorFor(lang, fallbacks);
      if (route.includes("bhashini→gemini")) fallbacks.push(route);
      try {
        translations[lang] = await translateView(doc, fn);
      } catch (err) {
        // One failing language shouldn't kill the whole pipeline. Swap in a
        // Gemini translation and record the degradation.
        fallbacks.push(`${lang}:primary-failed→gemini`);
        const gem = (t: string) => geminiTranslate(t, lang, fallbacks);
        translations[lang] = await translateView(doc, gem);
      }
    }),
  );

  return {
    translated: { ...doc, translations },
    fallbacks,
  };
}

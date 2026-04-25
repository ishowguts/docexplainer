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
//
//  IMPORTANT: Gemini translation uses a single batched JSON call per
//  language (not one call per field) to stay within free-tier rate limits.
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

// Per-language system instruction for the Gemini batched-JSON translation.
const GEMINI_TRANSLATE_INSTRUCTION: Record<Exclude<LanguageCode, "en">, string> = {
  hi:
    "You are a professional English-to-Hindi translator. I will give you a JSON object. " +
    "You MUST translate EVERY string value in the JSON from English to natural, " +
    "conversational Hindi in Devanagari script. This includes the title, summary, " +
    "every term, every meaning, every clause, every reason, and every action field. " +
    "Do NOT leave any string value in English. Do NOT skip any field. " +
    "Explain medical/legal jargon in simple Hindi words rather than transliterating English words. " +
    "Do NOT change JSON keys (title, summary, keyTerms, etc.) — only translate the VALUES. " +
    "Do NOT change the values of 'level' or 'priority' fields — keep them as 'high', 'medium', 'low', 'now', 'soon', 'later'. " +
    "Return ONLY the translated JSON object. No explanation, no preamble, no markdown code fences.",
  hinglish:
    "You are a professional translator. I will give you a JSON object. " +
    "You MUST translate EVERY string value in the JSON into Hinglish — everyday Indian " +
    "urban speech that mixes Hindi and English, written in Roman/Latin script. " +
    "This includes the title, summary, every term, every meaning, every clause, " +
    "every reason, and every action field. Do NOT leave any field untranslated. " +
    "Keep common English words (doctor, report, contract, deposit, clause) as-is. " +
    "Be casual and conversational, like explaining to a friend over chai. " +
    "Do NOT change JSON keys — only translate the VALUES. " +
    "Do NOT change the values of 'level' or 'priority' fields — keep them as 'high', 'medium', 'low', 'now', 'soon', 'later'. " +
    "Return ONLY the translated JSON object. No explanation, no preamble, no markdown code fences.",
  bn:
    "You are a professional English-to-Bengali translator. I will give you a JSON object. " +
    "You MUST translate EVERY string value in the JSON from English to natural, " +
    "conversational Bengali in Bengali script. This includes the title, summary, " +
    "every term, every meaning, every clause, every reason, and every action field. " +
    "Do NOT leave any string value in English. Do NOT skip any field. " +
    "Explain medical/legal jargon in simple Bengali words rather than transliterating English words. " +
    "Do NOT change JSON keys (title, summary, keyTerms, etc.) — only translate the VALUES. " +
    "Do NOT change the values of 'level' or 'priority' fields — keep them as 'high', 'medium', 'low', 'now', 'soon', 'later'. " +
    "Return ONLY the translated JSON object. No explanation, no preamble, no markdown code fences.",
};

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

// ---- Bhashini view translator (field-by-field) ----------------------------

async function translateViewBhashini(
  doc: ExplainedDoc,
  targetLang: string,
): Promise<TranslatedView> {
  const [title, summary, keyTerms, riskFlags, actionItems] = await Promise.all([
    bhashiniTranslate(doc.title, targetLang),
    bhashiniTranslate(doc.summary, targetLang),
    Promise.all(
      doc.keyTerms.map(async (t) => ({
        term: await bhashiniTranslate(t.term, targetLang),
        meaning: await bhashiniTranslate(t.meaning, targetLang),
      })),
    ),
    Promise.all(
      doc.riskFlags.map(async (f) => ({
        level: f.level,
        clause: await bhashiniTranslate(f.clause, targetLang),
        reason: await bhashiniTranslate(f.reason, targetLang),
      })),
    ),
    Promise.all(
      doc.actionItems.map(async (a) => ({
        action: await bhashiniTranslate(a.action, targetLang),
        priority: a.priority,
      })),
    ),
  ]);
  return { title, summary, keyTerms, riskFlags, actionItems };
}

// ---- Gemini batched-JSON path ---------------------------------------------

/**
 * Strip markdown code fences from an LLM response so JSON.parse works.
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Translate the entire ExplainedDoc in a SINGLE Gemini call by sending
 * a JSON payload and asking the model to translate all string values.
 * This avoids making 20-30 parallel API calls that exhaust free-tier rate limits.
 */
async function translateViewGemini(
  doc: ExplainedDoc,
  lang: Exclude<LanguageCode, "en">,
  trace?: string[],
): Promise<TranslatedView> {
  // Build the payload — only the translatable fields, no metadata.
  const payload = {
    title: doc.title,
    summary: doc.summary,
    keyTerms: doc.keyTerms.map((t) => ({ term: t.term, meaning: t.meaning })),
    riskFlags: doc.riskFlags.map((f) => ({
      level: f.level,
      clause: f.clause,
      reason: f.reason,
    })),
    actionItems: doc.actionItems.map((a) => ({
      action: a.action,
      priority: a.priority,
    })),
  };

  const prompt = `${GEMINI_TRANSLATE_INSTRUCTION[lang]}\n\n${JSON.stringify(payload, null, 2)}`;

  const raw = await callGemini(prompt, {
    modelChain: GEMINI_TRANSLATE_CHAIN,
    trace,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // If the model returned invalid JSON, try a simpler single-field fallback
    console.error("[translate] Gemini returned invalid JSON, using fallback structure");
    return {
      title: doc.title,
      summary: doc.summary,
      keyTerms: doc.keyTerms,
      riskFlags: doc.riskFlags,
      actionItems: doc.actionItems,
    };
  }

  // Validate and coerce — never trust the LLM to return perfect structure
  return {
    title: String(parsed?.title ?? doc.title),
    summary: String(parsed?.summary ?? doc.summary),
    keyTerms: Array.isArray(parsed?.keyTerms)
      ? parsed.keyTerms.map((t: any, i: number) => ({
          term: String(t?.term ?? doc.keyTerms[i]?.term ?? ""),
          meaning: String(t?.meaning ?? doc.keyTerms[i]?.meaning ?? ""),
        }))
      : doc.keyTerms,
    riskFlags: Array.isArray(parsed?.riskFlags)
      ? parsed.riskFlags.map((f: any, i: number) => ({
          level: ["high", "medium", "low"].includes(f?.level)
            ? f.level
            : doc.riskFlags[i]?.level ?? "low",
          clause: String(f?.clause ?? doc.riskFlags[i]?.clause ?? ""),
          reason: String(f?.reason ?? doc.riskFlags[i]?.reason ?? ""),
        }))
      : doc.riskFlags,
    actionItems: Array.isArray(parsed?.actionItems)
      ? parsed.actionItems.map((a: any, i: number) => ({
          action: String(a?.action ?? doc.actionItems[i]?.action ?? ""),
          priority: ["now", "soon", "later"].includes(a?.priority)
            ? a.priority
            : doc.actionItems[i]?.priority ?? "soon",
        }))
      : doc.actionItems,
  };
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
      // Hinglish is always Gemini — Bhashini has no Hinglish model.
      if (lang === "hinglish") {
        fallbacks.push("gemini:hinglish");
        try {
          translations[lang] = await translateViewGemini(doc, lang, fallbacks);
        } catch (err) {
          console.error(`[translate] Gemini hinglish failed:`, err);
          fallbacks.push("hinglish:failed");
        }
        return;
      }

      // For hi/bn, prefer Bhashini if creds are available.
      const bhashCode = BHASHINI_LANGS[lang];
      if (bhashCode && hasBhashini()) {
        try {
          translations[lang] = await translateViewBhashini(doc, bhashCode);
          return;
        } catch (err) {
          // Bhashini failed — fall through to Gemini
          console.error(`[translate] Bhashini ${lang} failed, falling back to Gemini:`, err);
          fallbacks.push(`${lang}:bhashini-failed→gemini`);
        }
      } else {
        fallbacks.push(`gemini:${lang} (bhashini→gemini)`);
      }

      // Gemini fallback (or primary if no Bhashini creds)
      try {
        translations[lang] = await translateViewGemini(doc, lang as Exclude<LanguageCode, "en">, fallbacks);
      } catch (err) {
        console.error(`[translate] Gemini ${lang} also failed:`, err);
        fallbacks.push(`${lang}:all-backends-failed`);
      }
    }),
  );

  return {
    translated: { ...doc, translations },
    fallbacks,
  };
}

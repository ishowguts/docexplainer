// ---------------------------------------------------------------------------
//  Shared Gemini client with three distinct error classes, each handled
//  correctly:
//
//    1. MODEL UNAVAILABLE  (limit: 0 on free tier, e.g. gemini-3-pro)
//       → the model itself is paid-only; rotating keys won't help.
//         Skip this model for ALL keys, continue to next model on same key.
//
//    2. KEY QUOTA / AUTH   (429 with real quota, 401, 403)
//       → this specific key is capped for the day, but a fresh key will work.
//         Rotate to the next API key, starting the model chain over.
//
//    3. TRANSIENT OVERLOAD (503, "high demand")
//       → Google's servers are busy right now. Retry once with backoff, then
//         drop to the next cheaper model on the same key.
//
//  This matches the PagerDuty-style on-call rotation the user asked for,
//  but with proper error classification so we don't waste keys on models
//  that are globally unavailable.
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai";

// Default model chain for explain-style prompts. We LEAD with the cheaper,
// free-tier-accessible models so a demo on free keys actually works, and
// only reach for gemini-3-pro if a paid key is available. Reordering this
// list is the main lever if you ever switch to paid tier.
export const GEMINI_EXPLAIN_CHAIN = [
  "gemini-2.5-flash-lite", // proven free-tier accessible, fast
  "gemini-2.0-flash",      // older free-tier backup
  "gemini-3-flash",        // new generation, may require paid tier
  "gemini-3-pro-preview",  // best quality, often paid-only (limit:0 on free)
] as const;

// Translation is short + high-volume — same free-tier-first ordering.
export const GEMINI_TRANSLATE_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

/**
 * Collect every Gemini API key available in the environment.
 * Looks for GEMINI_API_KEY (the original), plus GEMINI_API_KEY_2..5.
 * Returns them in order, de-duped, skipping empty slots.
 */
export function getGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ];
  const keys: string[] = [];
  for (const k of candidates) {
    if (k && k.trim() && !keys.includes(k.trim())) keys.push(k.trim());
  }
  return keys;
}

/**
 * "limit: 0" is a model-availability signal, not a per-key-quota signal.
 * Gemini returns it for paid-only models (e.g. gemini-3-pro-preview) when
 * hit with a free-tier key. Rotating keys never helps — we need the next
 * model in the chain instead.
 */
function isModelUnavailableOnTier(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Match "limit: 0," or "limit: 0 " — present in Google's quota-failure body
  // when the model has no free-tier allowance at all.
  return /limit:\s*0\b/i.test(msg);
}

/** Transient overload — same model might work on retry. */
function isOverload(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /503|unavailable|overload|high demand/i.test(msg);
}

/** Real per-key quota exhaustion or auth failure — try the next key. */
function isQuotaOrAuth(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|rate limit|too many requests|401|403|api key|permission/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CallGeminiOptions {
  /** Optional override of the model fallback chain. */
  modelChain?: readonly string[];
  /** If provided, fallback events are appended here for pipeline telemetry. */
  trace?: string[];
}

/**
 * Call Gemini's generateContent with full key × model × retry fallback.
 *
 *   Outer  : each API key in turn
 *     Middle : each model in the chain (skipping any we've learned are
 *              globally unavailable on this tier)
 *       Inner  : up to 2 attempts with 1.5s backoff on transient overload
 */
export async function callGemini(
  prompt: string,
  opts: CallGeminiOptions = {},
): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error(
      "No Gemini API keys found. Set GEMINI_API_KEY (and optionally " +
        "GEMINI_API_KEY_2..5 for rotation) in .env.local.",
    );
  }

  const chain = opts.modelChain ?? GEMINI_EXPLAIN_CHAIN;
  // Models whose free/paid tier doesn't allow them at all. Once we learn
  // one has limit:0, we skip it for every subsequent key attempt.
  const skipModels = new Set<string>();
  let lastErr: unknown = null;

  // We do up to 2 full passes. The second pass adds a cooldown delay in case
  // the first pass hit rate-limits that will clear within a few seconds.
  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) {
      // Cooldown before second pass — give RPM windows time to slide.
      await sleep(3000);
      if (opts.trace) opts.trace.push("gemini:retry-pass-2-after-cooldown");
    }

    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const client = new GoogleGenerativeAI(keys[keyIdx]);
      let keyExhausted = false;

      for (const modelName of chain) {
        if (skipModels.has(modelName)) continue;

        const model = client.getGenerativeModel({ model: modelName });

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const result = await model.generateContent(prompt);
            // Record any deviation from "first key, first model" in telemetry.
            if (opts.trace && (keyIdx > 0 || modelName !== chain[0] || pass > 0)) {
              opts.trace.push(`gemini:key${keyIdx + 1}/${modelName}${pass > 0 ? "/pass2" : ""}`);
            }
            return result.response.text();
          } catch (err) {
            lastErr = err;

            // MODEL UNAVAILABLE (limit: 0) — this model won't work on any key.
            // Blacklist it globally and move to next model on same key.
            if (isModelUnavailableOnTier(err)) {
              skipModels.add(modelName);
              if (opts.trace) {
                opts.trace.push(`gemini:${modelName}-unavailable-on-tier`);
              }
              break; // break attempt loop → next model on same key
            }

            // KEY QUOTA / AUTH — this key is dead, rotate to next key.
            if (isQuotaOrAuth(err)) {
              if (opts.trace) {
                opts.trace.push(`gemini:key${keyIdx + 1}-exhausted→rotating`);
              }
              keyExhausted = true;
              break; // break attempt loop
            }

            // TRANSIENT OVERLOAD — retry same (key, model) once with backoff.
            if (isOverload(err) && attempt === 0) {
              await sleep(2500);
              continue;
            }

            // Non-transient or second failure → drop to next model.
            break;
          }
        }

        if (keyExhausted) break; // stop iterating models for this key
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `All Gemini API keys and models exhausted. Last error: ${msg}`,
  );
}

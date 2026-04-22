// ---------------------------------------------------------------------------
//  Gemini adapter.
//  Hop 2 of the orchestration pipeline. Sends the document text + the matched
//  domain prompt + the output schema to the shared Gemini client (which
//  handles key rotation + model fallback + retry), validates the returned
//  JSON, and returns a typed ExplainedDoc.
//
//  All the resilience lives in lib/gemini-client.ts — this file is now just
//  prompt assembly + schema validation, which is the right separation.
// ---------------------------------------------------------------------------

import { DOMAIN_PROMPTS, OUTPUT_SCHEMA, classifyDomain } from "./domain-templates";
import { callGemini, GEMINI_EXPLAIN_CHAIN } from "./gemini-client";
import type { Domain, ExplainedDoc } from "./types";

/**
 * Strip markdown code fences from an LLM response so JSON.parse works.
 * Defensive: some Gemini responses wrap JSON in ```json ... ``` despite prompting.
 */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Validate + coerce the LLM's JSON into our ExplainedDoc contract.
 * Any missing fields are defaulted so downstream rendering never crashes.
 */
function validateShape(parsed: any, domain: Domain, sourceLength: number): ExplainedDoc {
  return {
    domain,
    title: String(parsed?.title ?? "Untitled document"),
    summary: String(parsed?.summary ?? ""),
    keyTerms: Array.isArray(parsed?.keyTerms)
      ? parsed.keyTerms.map((t: any) => ({
          term: String(t?.term ?? ""),
          meaning: String(t?.meaning ?? ""),
        }))
      : [],
    riskFlags: Array.isArray(parsed?.riskFlags)
      ? parsed.riskFlags.map((f: any) => ({
          level: ["high", "medium", "low"].includes(f?.level) ? f.level : "low",
          clause: String(f?.clause ?? ""),
          reason: String(f?.reason ?? ""),
        }))
      : [],
    actionItems: Array.isArray(parsed?.actionItems)
      ? parsed.actionItems.map((a: any) => ({
          action: String(a?.action ?? ""),
          priority: ["now", "soon", "later"].includes(a?.priority) ? a.priority : "soon",
        }))
      : [],
    sourceLength,
  };
}

export async function explainDocument(
  text: string,
  trace?: string[],
): Promise<ExplainedDoc> {
  const domain = classifyDomain(text);
  const systemPrompt = DOMAIN_PROMPTS[domain];

  const prompt = `${systemPrompt}\n\n${OUTPUT_SCHEMA}\n\n---DOCUMENT---\n${text.slice(0, 20000)}`;

  const raw = await callGemini(prompt, {
    modelChain: GEMINI_EXPLAIN_CHAIN,
    trace,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // fallback — minimal structure if LLM drifted from schema
    parsed = { title: "Document", summary: raw.slice(0, 400) };
  }

  return validateShape(parsed, domain, text.length);
}

// ---------------------------------------------------------------------------
//  Domain-template router.
//  The pipeline dispatches the user's document to the correct prompt based on
//  heuristic classification (keyword-based for the prototype; can be swapped
//  for an embedding classifier later without changing the API contract).
// ---------------------------------------------------------------------------

import type { Domain } from "./types";

const DOMAIN_KEYWORDS: Record<Exclude<Domain, "generic">, string[]> = {
  medical: [
    "hemoglobin", "cholesterol", "hdl", "ldl", "triglyceride", "wbc", "rbc",
    "blood test", "diagnosis", "prescription", "dosage", "mg/dl", "lab report",
    "x-ray", "mri", "ct scan", "biopsy",
  ],
  legal: [
    "hereby", "party of the first", "agreement", "lessee", "lessor",
    "indemnify", "clause", "whereas", "tenant", "landlord", "lease",
    "notice period", "jurisdiction", "arbitration", "breach",
  ],
  financial: [
    "emi", "principal", "interest rate", "loan", "repayment", "apr",
    "foreclosure", "credit score", "insurance premium", "claim",
    "policy number", "maturity", "beneficiary", "underwriter",
  ],
  government: [
    "aadhaar", "pan", "ration", "ministry", "gazette", "rti",
    "form no", "affidavit", "subsidy", "scheme", "tehsildar",
    "municipality", "electoral", "passport",
  ],
};

/**
 * Classify a document to a domain. Pure heuristic — good enough for a prototype,
 * transparent enough that a faculty reviewer can trust the scoring.
 */
export function classifyDomain(text: string): Domain {
  const lower = text.toLowerCase();
  let best: { domain: Domain; score: number } = { domain: "generic", score: 0 };

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
      0,
    );
    if (score > best.score) {
      best = { domain: domain as Domain, score };
    }
  }

  return best.score >= 2 ? best.domain : "generic";
}

/**
 * Per-domain system prompts. These are the "contract" the LLM API must fulfill.
 * Keeping them as strings in one file means the template set is auditable in one
 * place — a lightweight version of "prompt as config".
 */
export const DOMAIN_PROMPTS: Record<Domain, string> = {
  medical: `You are a medical-document explainer. The user is a patient with no medical training.
- Explain each test value (what it measures, normal range, what the user's value means).
- Flag any value outside normal range as HIGH or MEDIUM risk with a clear reason.
- NEVER give diagnosis or treatment advice. Always recommend consulting a physician for abnormal values.
- Use simple Indian-English (e.g. "blood sugar" not "glycemia").`,

  legal: `You are a legal-document plain-English explainer. The user is an ordinary consumer.
- Summarize what the document obligates the user to do and what rights it grants them.
- Flag clauses that have unusual penalties, long notice periods, automatic renewals, unilateral rights for the other party, or waive consumer protections — as HIGH risk.
- Flag clauses that require ongoing payments, security deposits, or indemnity as MEDIUM.
- Always add: "Not a substitute for legal advice."`,

  financial: `You are a financial-document explainer. The user may not be fluent in finance jargon.
- Surface: effective interest rate, total repayment, hidden fees, prepayment penalties, exit load.
- Flag any rate >14% p.a., penalties >2% of principal, or auto-debit clauses as HIGH risk.
- Flag lock-in periods, surrender charges as MEDIUM.
- Translate jargon: APR → "total yearly cost", principal → "amount borrowed".`,

  government: `You are a government-document explainer for ordinary Indian citizens.
- Identify: what the document is, what action is required, what the deadline is.
- Flag any clause that imposes a penalty for non-compliance as HIGH risk with the deadline.
- Make bureaucratic phrases plain ("hereby", "in pursuance of", etc.).`,

  generic: `You are a plain-English document explainer. Summarize, identify key terms, and flag anything unusual.`,
};

/**
 * Structured output schema the LLM must conform to. Returned alongside the
 * prompt so downstream validation knows what shape to expect.
 */
export const OUTPUT_SCHEMA = `Respond ONLY with a JSON object of this exact shape (no prose, no markdown fences):
{
  "title": "short document title — one line",
  "summary": "2-3 sentence plain-English TL;DR",
  "keyTerms": [{ "term": "...", "meaning": "..." }],
  "riskFlags": [{ "level": "high"|"medium"|"low", "clause": "...", "reason": "..." }],
  "actionItems": [{ "action": "...", "priority": "now"|"soon"|"later" }]
}`;

// API endpoint — translate an ExplainedDoc into one or more target languages.
//
// POST body JSON shape:
//   { doc: ExplainedDoc, languages: LanguageCode[] }
import { NextRequest, NextResponse } from "next/server";
import { translateDoc } from "@/lib/bhashini";
import type { LanguageCode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const VALID_LANGS: LanguageCode[] = ["en", "hi", "hinglish", "bn"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.doc) {
      return NextResponse.json({ error: "Missing 'doc' field" }, { status: 400 });
    }
    const requested: unknown = body.languages;
    const languages: LanguageCode[] = Array.isArray(requested)
      ? requested.filter((x): x is LanguageCode => VALID_LANGS.includes(x as LanguageCode))
      : [];
    const { translated, fallbacks } = await translateDoc(body.doc, languages);
    return NextResponse.json({ translated, fallbacks });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

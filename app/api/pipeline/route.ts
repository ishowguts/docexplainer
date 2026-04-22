// API endpoint — full orchestration pipeline: PDF → parse → explain → translate.
// The UI calls this single endpoint; internally it chains the three hops and
// returns the combined result + timing metadata.
//
// FormData fields:
//   file        : the PDF (required)
//   languages   : JSON array of LanguageCode, e.g. '["hi","hinglish"]' (optional;
//                 defaults to [] which means English-only)
//
// Status codes:
//   200  success
//   400  bad input (no file)
//   422  unsupported-domain (PDF didn't match any supported domain)
//   500  any other pipeline failure
import { NextRequest, NextResponse } from "next/server";
import { runPipeline, UnsupportedDomainError } from "@/lib/pipeline";
import type { LanguageCode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_LANGS: LanguageCode[] = ["en", "hi", "hinglish", "bn"];

function parseLanguages(raw: FormDataEntryValue | null): LanguageCode[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is LanguageCode => VALID_LANGS.includes(x));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
    }
    const languages = parseLanguages(form.get("languages"));
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runPipeline(buffer, { languages });
    return NextResponse.json(result);
  } catch (err: any) {
    // Domain mismatch is an expected "bad upload" outcome, not a server
    // error. Return 422 with a user-facing message so the UI can show a
    // soft warning rather than a red 500 stacktrace.
    if (err instanceof UnsupportedDomainError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: err?.message ?? "Pipeline failure" },
      { status: 500 },
    );
  }
}

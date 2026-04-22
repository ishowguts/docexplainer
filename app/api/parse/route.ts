// API endpoint 1 — parse a PDF and return raw text. Separate route so the
// parsing layer can be consumed independently (e.g. by a mobile client).
import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parsePdf(buffer);
  return NextResponse.json(result);
}

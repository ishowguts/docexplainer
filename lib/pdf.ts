// ---------------------------------------------------------------------------
//  PDF parsing layer.
//  Hop 1 of the orchestration pipeline. Extracts raw text from an uploaded PDF
//  buffer. If the PDF is scanned (no extractable text), returns an empty string
//  so the caller can decide to fall back to OCR.
// ---------------------------------------------------------------------------

import pdfParse from "pdf-parse";

export interface ParsedPdf {
  text: string;
  pageCount: number;
  isScanned: boolean;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const result = await pdfParse(buffer);
  const text = (result.text || "").trim();
  return {
    text,
    pageCount: result.numpages,
    // if avg chars-per-page < 50, treat as scanned — OCR fallback needed
    isScanned: text.length / Math.max(result.numpages, 1) < 50,
  };
}

# DocExplainer

**An API-orchestration pipeline for consumer document understanding.**

Upload a medical, legal, financial, or government PDF. DocExplainer chains three
external APIs — `pdf-parse` → Google Gemini → Bhashini — to return a structured,
plain-language breakdown with automatic risk-flagging and a side-by-side Hindi
translation.

Built as a BTP Minor Project (Development + API track) at IIIT Pune.

---

## Why this project is a Dev + API project (not an AI project)

The engineering contribution is the **pipeline**, not the LLM. DocExplainer
demonstrates:

- **Multi-API orchestration** with independent, swappable service adapters
  (`lib/gemini.ts`, `lib/bhashini.ts`, `lib/pdf.ts`).
- **JSON-schema contracts** (`lib/types.ts`) that every hop must satisfy, so any
  adapter can be replaced without touching the UI.
- **Graceful fallback chains** — if Bhashini credentials are missing, the
  translate hop falls back to a Gemini-based translator and logs the degraded
  path in pipeline metadata.
- **Domain-template routing** (`lib/domain-templates.ts`) — a keyword classifier
  dispatches documents to one of four purpose-built prompts.
- **Per-hop telemetry** surfaced in the UI so reviewers see where time is spent.

Gemini is treated exactly like Stripe or Twilio would be: one SaaS API that the
pipeline calls.

---

## Quick start

```bash
cd docexplainer
npm install
cp .env.example .env.local
# edit .env.local and add your GEMINI_API_KEY
npm run dev
```

Open <http://localhost:3000> and drop a PDF.

### Get a free Gemini key

<https://aistudio.google.com/apikey>

No credit card, 15 requests/min free. More than enough for the demo.

### (Optional) Bhashini credentials

Register at <https://bhashini.gov.in/ulca/user/register>. If you don't, the
pipeline transparently falls back to Gemini for translation and shows
`fallback: bhashini→gemini` in the result header.

---

## Deploy to Vercel (one command)

```bash
npx vercel
```

Add `GEMINI_API_KEY` as an environment variable in the Vercel dashboard.

---

## Project structure

```
docexplainer/
├── app/
│   ├── page.tsx              UI — hero, upload, result
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── parse/route.ts    Hop 1 — PDF text extraction
│       ├── explain/route.ts  Hop 2 — Gemini structured output
│       ├── translate/route.ts Hop 3 — Bhashini (with Gemini fallback)
│       └── pipeline/route.ts End-to-end orchestrator
├── components/
│   ├── upload-zone.tsx
│   ├── result-view.tsx
│   └── risk-flag.tsx
├── lib/
│   ├── types.ts              Shared JSON-schema contracts
│   ├── pdf.ts                pdf-parse wrapper
│   ├── gemini.ts             Gemini adapter + schema validation
│   ├── bhashini.ts           Bhashini adapter + Gemini fallback
│   ├── pipeline.ts           The orchestrator
│   └── domain-templates.ts   Domain classifier + per-domain prompts
└── public/samples/           (Drop demo PDFs here)
```

---

## Roadmap (for the BTP writeup)

- [x] PDF parsing
- [x] Gemini structured explainer with per-domain prompts
- [x] Risk flagging with 3-level classification
- [x] Bhashini English→Hindi translation with Gemini fallback
- [x] Per-hop telemetry surfaced in UI
- [ ] OCR fallback for scanned PDFs (Tesseract.js)
- [ ] Additional Indian languages via Bhashini (Tamil, Telugu, Bengali)
- [ ] Rate-limit + caching layer (Upstash Redis)
- [ ] Mobile PWA wrapper

---

## License

MIT — free to reuse for student projects.

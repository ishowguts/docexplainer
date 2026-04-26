# DocExplainer

BTP Minor Project by Bittu Mandal (MIS: 112415048)

Basically, most people in India get documents like rent agreements, lab reports, loan papers, etc. in English full of jargon they don't understand. This project takes a PDF, breaks it down in simple language, flags risky clauses, and can even translate the whole thing to Hindi, Bengali or Hinglish.

Live at: https://docexplainer.vercel.app

---

## What it does

1. You upload a PDF (rent agreement, blood test report, insurance policy, govt notice, etc.)
2. It extracts the text from the PDF
3. Figures out what kind of document it is (medical? legal? financial? government?)
4. Sends it to Gemini AI to get a plain-English summary with risk flags, glossary, and action items
5. Optionally translates everything to Hindi / Bengali / Hinglish

The whole thing runs as a pipeline — parse → classify → explain → translate — and the UI shows you how long each step took.

---

## Tech stack

**Frontend:** Next.js 14 with React 18, TypeScript, and Tailwind CSS. Used Lucide for icons and react-dropzone for the file upload drag-and-drop.

**Backend:** Next.js API routes (serverless functions on Vercel). No separate backend server needed — the API routes handle everything.

**PDF parsing:** `pdf-parse` npm package. Runs entirely on the server, no external API call. Just pass it a buffer and it gives you the text back. Doesn't work on scanned PDFs though (would need OCR for that).

**AI / LLM:** Google Gemini API via `@google/generative-ai` SDK. Used for both the document explanation (structured JSON output) and as a translation fallback.

**Translation:** Bhashini API (Govt of India neural translation) for Hindi and Bengali when the API key is set up. Falls back to Gemini for translation if Bhashini creds aren't available. Hinglish always goes through Gemini since Bhashini doesn't support it.

**Hosting:** Vercel — auto-deploys on push to main branch.

---

## How the pipeline works

The main endpoint is `POST /api/pipeline`. Internally it chains 3 hops:

```
PDF upload
    ↓
Hop 1: pdf-parse extracts text (~200-500ms)
    ↓
Safety gate: keyword classifier checks if it's medical/legal/financial/govt
    ↓  (rejects if it doesn't match any domain)
Hop 2: Gemini explains the document as structured JSON (~3-5s)
    ↓
Hop 3: Bhashini or Gemini translates to selected languages (~4-8s per language)
    ↓
Response with data + timing metadata
```

Each hop is timed and the UI shows parse/explain/translate latency separately.

---

## API key rotation

Since I'm on the free tier, I added support for up to 5 Gemini API keys that rotate automatically. If one key hits its daily quota (429 error), the system tries the next one. If all keys fail, it waits 3 seconds and does a second pass in case it was just a per-minute rate limit.

The model fallback chain is:
1. `gemini-2.5-flash-lite` (primary, works on free tier)
2. `gemini-2.0-flash` (backup)
3. `gemini-3-flash` (might need paid tier)
4. `gemini-3-pro-preview` (usually paid-only)

If a model returns `limit: 0`, it gets blacklisted globally — no point trying it with other keys.

---

## Domain classification

Before sending anything to Gemini, the text goes through a keyword-based classifier (`lib/domain-templates.ts`). Each domain has ~15 keywords:
- Medical: hemoglobin, cholesterol, blood test, x-ray, etc.
- Legal: hereby, lessee, clause, landlord, jurisdiction, etc.
- Financial: EMI, interest rate, loan, insurance premium, etc.
- Government: aadhaar, RTI, ministry, gazette, affidavit, etc.

It counts keyword hits and picks the domain with the most matches. Needs at least 2 hits to classify — otherwise it rejects the document. This way random PDFs (like an OS lab manual) don't get processed.

Each domain has its own prompt template so Gemini knows what to look for (lab values for medical, risky clauses for legal, hidden fees for financial, deadlines for government).

---

## Translation

The translation system (`lib/bhashini.ts`) supports Hindi, Bengali, and Hinglish.

If Bhashini API keys are configured, Hindi and Bengali go through Bhashini first. If Bhashini fails or keys aren't set, it falls back to Gemini.

For Gemini translation, I batch the entire document into a single JSON payload instead of translating field-by-field. Earlier I was making ~25 separate API calls per language (one for title, one for summary, one for each risk flag, etc.) which kept hitting rate limits. Now it's just 1 call per language.

Hinglish (Roman script Hindi-English mix) always goes through Gemini — Bhashini doesn't have a Hinglish model.

---

## File structure

```
docexplainer/
├── app/
│   ├── api/
│   │   ├── pipeline/route.ts   ← main endpoint, chains all 3 hops
│   │   ├── translate/route.ts  ← add translation to existing result
│   │   ├── parse/route.ts      ← standalone PDF parse
│   │   └── explain/route.ts    ← standalone Gemini explain
│   ├── page.tsx                ← main UI (upload, submit, results)
│   ├── layout.tsx              ← root layout + SEO metadata
│   └── globals.css             ← tailwind imports + custom styles
├── components/
│   ├── upload-zone.tsx         ← drag-and-drop PDF upload
│   ├── language-picker.tsx     ← language selection pills
│   ├── result-view.tsx         ← result display with language tabs
│   └── risk-flag.tsx           ← color-coded risk cards
├── lib/
│   ├── pipeline.ts             ← orchestration (chains parse→explain→translate)
│   ├── pdf.ts                  ← PDF text extraction using pdf-parse
│   ├── gemini.ts               ← document explanation via Gemini
│   ├── gemini-client.ts        ← shared Gemini client with key rotation
│   ├── bhashini.ts             ← translation (Bhashini + Gemini fallback)
│   ├── domain-templates.ts     ← domain classifier + prompt templates
│   └── types.ts                ← TypeScript types for the whole pipeline
├── .env.local                  ← API keys (not committed)
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "next": "14.2.5",
    "pdf-parse": "^1.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-dropzone": "^14.2.3",
    "lucide-react": "^0.441.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "tailwindcss": "^3.4.7",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38"
  }
}
```

Quick breakdown:
- **@google/generative-ai** — official Gemini SDK
- **pdf-parse** — extracts text from PDFs server-side
- **react-dropzone** — the drag-and-drop upload zone
- **lucide-react** — icon library (upload, alert, language icons, etc.)
- **clsx** — utility for conditional CSS classes
- **tailwindcss + postcss + autoprefixer** — styling toolchain

---

## Environment variables

Create a `.env.local` file:

```
GEMINI_API_KEY=your-key-here
GEMINI_API_KEY_2=optional-second-key
GEMINI_API_KEY_3=optional-third-key
GEMINI_API_KEY_4=optional-fourth-key
GEMINI_API_KEY_5=optional-fifth-key

# Optional — falls back to Gemini if not set
BHASHINI_API_KEY=
BHASHINI_USER_ID=
```

Get a free Gemini key at https://aistudio.google.com/apikey. You can add multiple keys from different Google accounts to multiply your free-tier quota.

Same variables need to be added in Vercel dashboard under Settings → Environment Variables for production.

---

## Running locally

```bash
git clone https://github.com/ishowguts/docexplainer.git
cd docexplainer
npm install
# add your API keys to .env.local
npm run dev
# open http://localhost:3000
```

---

## What works and what doesn't

**Works:**
- Text-based PDFs (most digital documents)
- Medical, legal, financial, government documents
- Translation to Hindi, Bengali, Hinglish
- Multiple API key rotation for handling rate limits

**Limitations:**
- Scanned PDFs (image-only) won't work — would need OCR
- Documents outside the 4 supported domains get rejected
- Free-tier Gemini has rate limits — heavy usage might hit quotas even with multiple keys
- Bhashini API signup wasn't working at the time of development, so translation runs through Gemini

---

*DocExplainer — Bittu Mandal — MIS 112415048*

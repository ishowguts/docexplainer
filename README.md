# DocExplainer

**BTP Minor Project — Bittu Mandal — MIS: 112415048**

An API-orchestration pipeline that turns complex medical, legal, financial, and government documents into plain-language summaries — with risks flagged, key terms defined, action items listed, and multilingual translation support.

**Live URL:** [https://docexplainer.vercel.app](https://docexplainer.vercel.app)

---

## Table of Contents

1. [Tech Stack Overview](#tech-stack-overview)
2. [Frontend Technologies](#frontend-technologies)
3. [Backend Technologies](#backend-technologies)
4. [External APIs](#external-apis)
5. [Build & Dev Tools](#build--dev-tools)
6. [Project Architecture](#project-architecture)
7. [File Structure](#file-structure)
8. [Pipeline Flow](#pipeline-flow)
9. [API Routes](#api-routes)
10. [Key Algorithms & Logic](#key-algorithms--logic)
11. [Environment Variables](#environment-variables)
12. [Setup & Installation](#setup--installation)

---

## Tech Stack Overview

| Category           | Technology                 | Version  | Purpose                                      |
| ------------------ | -------------------------- | -------- | -------------------------------------------- |
| Framework          | Next.js                    | 14.2.5   | Full-stack React framework (SSR + API routes) |
| Language           | TypeScript                 | 5.4.5    | Type-safe JavaScript                         |
| UI Library         | React                      | 18.3.1   | Component-based UI rendering                 |
| CSS Framework      | Tailwind CSS               | 3.4.7    | Utility-first CSS styling                    |
| AI / LLM           | Google Gemini API           | 0.21.0   | Document explanation + translation           |
| Translation        | Bhashini API (optional)    | —        | Govt. of India neural translation (Hindi, Bengali) |
| PDF Parsing        | pdf-parse                  | 1.1.1    | Extract text from uploaded PDFs              |
| File Upload        | react-dropzone             | 14.2.3   | Drag-and-drop PDF upload UI                  |
| Icons              | Lucide React               | 0.441.0  | SVG icon components                          |
| CSS Utilities      | clsx                       | 2.1.1    | Conditional CSS class merging                |
| CSS Processing     | PostCSS + Autoprefixer     | 8.4.38   | CSS transforms + vendor prefixes             |
| Deployment         | Vercel                     | —        | Hosting + serverless functions               |

---

## Frontend Technologies

### 1. Next.js (v14.2.5)

**What:** A full-stack React framework by Vercel that provides server-side rendering (SSR), static site generation, file-based routing, and built-in API routes.

**Where used:** The entire application — both the user-facing UI and the backend API endpoints.

**Why:** Next.js allows us to build the frontend and backend in a single codebase. The App Router (`app/` directory) handles page rendering, and the API routes (`app/api/`) run as serverless functions on Vercel — no separate backend server needed.

**Key files:**
- `app/layout.tsx` — Root layout with metadata (title, description)
- `app/page.tsx` — Main page component with upload, submit, and result display
- `app/globals.css` — Global styles
- `next.config.js` — Configuration (enables `pdf-parse` as external server package)

---

### 2. React (v18.3.1)

**What:** A JavaScript library for building user interfaces using reusable components.

**Where used:** All UI components — the upload zone, language picker, result view, and risk flag chips.

**Why:** React's component model lets us break the UI into self-contained, reusable pieces. State management via `useState` and side effects via `useEffect` handle the entire application flow (file selection → upload → results → translation).

**Key components:**
- `components/upload-zone.tsx` — Drag-and-drop PDF upload area
- `components/language-picker.tsx` — Language selection pills (English, Hindi, Hinglish, Bengali)
- `components/result-view.tsx` — Full result display with language tabs, summary, risk flags, glossary, and action items
- `components/risk-flag.tsx` — Color-coded risk flag cards (High/Medium/Low)

---

### 3. TypeScript (v5.4.5)

**What:** A typed superset of JavaScript that adds static type checking.

**Where used:** Every `.ts` and `.tsx` file in the project.

**Why:** TypeScript catches type errors at build time, making the codebase safer and more maintainable. Critical for this project because JSON shapes flow between multiple API hops — the types in `lib/types.ts` act as a schema contract enforced at compile time.

**Key type definitions (in `lib/types.ts`):**
- `LanguageCode` — `"en" | "hi" | "hinglish" | "bn"`
- `Domain` — `"medical" | "legal" | "financial" | "government" | "generic"`
- `ExplainedDoc` — The structured output from Gemini (title, summary, keyTerms, riskFlags, actionItems)
- `TranslatedDoc` — ExplainedDoc + per-language translations
- `PipelineResult` — Final output with data + timing metadata

---

### 4. Tailwind CSS (v3.4.7)

**What:** A utility-first CSS framework where styles are applied using pre-built class names directly in HTML/JSX.

**Where used:** All component styling — layouts, colors, spacing, typography, animations, and responsive design.

**Why:** Tailwind eliminates the need for writing custom CSS files per component. The utility classes are readable inline and produce a small, optimized CSS bundle in production.

**Custom theme (in `tailwind.config.ts`):**
- `ink` (#0F172A) — Primary text color (dark navy)
- `accent` (#1E40AF) — Brand blue for buttons, active states
- `flag.high` (#DC2626) — Red for high-risk items
- `flag.med` (#F59E0B) — Amber for medium-risk items
- `flag.low` (#059669) — Green for low-risk items
- `font-display` — Georgia serif for headings
- `font-sans` — System UI font stack for body text

---

### 5. Lucide React (v0.441.0)

**What:** A library of beautifully crafted, open-source SVG icons as React components.

**Where used:** Throughout the UI for visual clarity.

**Why:** Provides clean, consistent icons without needing to create or import SVG files manually. Each icon is a tree-shakeable React component.

**Icons used:**
- `UploadCloud`, `FileText`, `X` — Upload zone
- `Languages`, `Check` — Language picker
- `Clock`, `Layers`, `Plus`, `Loader2` — Result view (timings, add language)
- `Stethoscope`, `Scale`, `Building2`, `Sparkles` — Domain category cards on home page
- `AlertTriangle`, `AlertCircle`, `Info` — Risk flag severity indicators

---

### 6. react-dropzone (v14.2.3)

**What:** A React hook-based library for creating drag-and-drop file upload areas.

**Where used:** `components/upload-zone.tsx` — The main file upload area on the homepage.

**Why:** Provides a polished drag-and-drop experience with built-in file type filtering (PDF only), multiple file prevention, and accessible keyboard input — all via the `useDropzone` hook.

---

### 7. clsx (v2.1.1)

**What:** A tiny utility for constructing CSS class strings conditionally.

**Where used:** Throughout components for conditional styling (active/inactive states, enabled/disabled states).

**Why:** Cleaner than manually concatenating class strings with ternary operators.

---

## Backend Technologies

### 8. Next.js API Routes (Serverless Functions)

**What:** Server-side endpoints that run as serverless functions, defined as files under `app/api/`.

**Where used:** Four API routes handle the pipeline:

| Route               | File                           | Purpose                                           |
| ------------------- | ------------------------------ | ------------------------------------------------- |
| `POST /api/pipeline` | `app/api/pipeline/route.ts`    | **Main endpoint** — chains parse → explain → translate |
| `POST /api/parse`    | `app/api/parse/route.ts`       | Standalone PDF text extraction                    |
| `POST /api/explain`  | `app/api/explain/route.ts`     | Standalone Gemini explanation                     |
| `POST /api/translate`| `app/api/translate/route.ts`   | Post-result translation (add language without re-upload) |

**Why:** Serverless functions eliminate the need for a separate backend server. They scale automatically on Vercel and keep API keys secure on the server side.

---

### 9. pdf-parse (v1.1.1)

**What:** A Node.js library that extracts text content from PDF files. It works locally on the server — **no external API call needed**.

**Where used:** `lib/pdf.ts` — Hop 1 of the orchestration pipeline.

**Why:** Free, fast, and runs entirely server-side. No API key, no network latency, no per-page charges. Takes a raw PDF `Buffer` and returns extracted text + page count.

**How it works:**
1. User uploads PDF → sent as `FormData` to `/api/pipeline`
2. `parsePdf(buffer)` calls `pdfParse(buffer)` internally
3. Returns `{ text, pageCount, isScanned }`
4. If avg characters per page < 50, flags as scanned (image-only PDF — OCR would be needed)

**Limitation:** Cannot extract text from scanned/image-only PDFs. Those would require OCR (e.g., Google Vision API or Tesseract).

---

### 10. Domain Classification — Keyword Heuristic

**What:** A custom keyword-based classifier that determines whether a document is medical, legal, financial, or government.

**Where used:** `lib/domain-templates.ts` — Safety gate before Gemini explanation.

**Why:** Each domain gets a specialized prompt (e.g., medical prompts emphasize test values and normal ranges; legal prompts flag unusual clauses). The classifier ensures the right prompt is used. Documents that don't match any domain are rejected with a friendly error.

**How it works:**
- Each domain has a list of ~15 keywords (e.g., medical: "hemoglobin", "cholesterol", "x-ray")
- The classifier counts keyword hits in the document text
- The domain with the most hits wins (minimum 2 hits required)
- If no domain gets ≥2 hits → classified as "generic" → rejected

---

## External APIs

### 11. Google Gemini API (`@google/generative-ai` v0.21.0)

**What:** Google's generative AI API for large language models. Used for both document explanation and translation.

**Where used:**
- `lib/gemini-client.ts` — Shared client with key rotation + model fallback + retry logic
- `lib/gemini.ts` — Document explanation (Hop 2: text → structured JSON summary)
- `lib/bhashini.ts` — Translation fallback (Hop 3: English → Hindi/Bengali/Hinglish)

**Why:** Gemini provides free-tier access with generous rate limits. The structured JSON output mode lets us get reliable, parseable responses.

**Models used (in priority order):**

For explanation:
1. `gemini-2.5-flash-lite` — Fast, free-tier accessible (primary)
2. `gemini-2.0-flash` — Older free-tier backup
3. `gemini-3-flash` — New generation (may require paid tier)
4. `gemini-3-pro-preview` — Best quality (often paid-only)

For translation:
1. `gemini-2.5-flash-lite` — Primary
2. `gemini-2.0-flash` — Backup

**Key rotation system:**
- Supports up to 5 API keys (`GEMINI_API_KEY`, `GEMINI_API_KEY_2..5`)
- If one key hits its daily quota (429 error), automatically rotates to the next
- If all keys fail on first pass, waits 3 seconds and retries all keys (handles RPM limits)
- Models marked as tier-unavailable (limit: 0) are skipped globally

**Error classification:**
| Error Type           | Detection                        | Action                         |
| -------------------- | -------------------------------- | ------------------------------ |
| Model unavailable    | `limit: 0` in response           | Skip model for all keys        |
| Key quota exhausted  | 429, 401, 403                     | Rotate to next API key         |
| Transient overload   | 503, "high demand"                | Retry same key after 2.5s      |

---

### 12. Bhashini API (Optional)

**What:** Government of India's neural machine translation API for Indian languages.

**Where used:** `lib/bhashini.ts` — Primary translation backend for Hindi and Bengali (when API keys are configured).

**Why:** Bhashini provides high-quality, free neural translations specifically trained for Indian languages. Falls back to Gemini translation if Bhashini credentials are not set.

**Endpoint:** `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`

**Supported languages:**
- Hindi (`hi`) — Bhashini primary, Gemini fallback
- Bengali (`bn`) — Bhashini primary, Gemini fallback
- Hinglish — Gemini only (Bhashini has no Hinglish model)

**Translation approach (Gemini fallback):**
- Entire document structure is sent as a single JSON payload
- Gemini translates all string values in one call (not per-field)
- This reduces API calls from ~25 to 1 per language, avoiding rate-limit issues

---

## Build & Dev Tools

### 13. PostCSS (v8.4.38) + Autoprefixer (v10.4.19)

**What:** PostCSS is a CSS transformation tool; Autoprefixer adds vendor prefixes automatically.

**Where used:** `postcss.config.js` — Processes Tailwind CSS output.

**Why:** Required by Tailwind CSS. Autoprefixer ensures CSS works across all browsers (adds `-webkit-`, `-moz-` prefixes where needed).

---

### 14. Vercel (Deployment)

**What:** A cloud platform for deploying frontend and full-stack applications.

**Where used:** Production hosting at `docexplainer.vercel.app`.

**Why:** Vercel is the creator of Next.js, so deployment is seamless — push to GitHub and it auto-deploys. API routes run as serverless functions with automatic scaling. Environment variables (API keys) are stored securely.

**Configuration:**
- Auto-deploy on push to `main` branch
- Environment variables: `GEMINI_API_KEY`, `GEMINI_API_KEY_2..4`
- Serverless function timeout: 60s (pipeline), 45s (translate)

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js App Router (React + TypeScript + Tailwind CSS)      │
│                                                              │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐ │
│  │ Upload   │  │ Language   │  │ Result    │  │ Risk     │ │
│  │ Zone     │→ │ Picker     │→ │ View      │  │ Flag     │ │
│  └──────────┘  └────────────┘  └───────────┘  └──────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/pipeline
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (API Routes)                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  Orchestration Pipeline                   │ │
│  │                                                          │ │
│  │  Hop 1: PDF Parse     ──→  pdf-parse (local, no API)    │ │
│  │           ↓                                              │ │
│  │  Safety Gate          ──→  Domain Classifier (keywords)  │ │
│  │           ↓                                              │ │
│  │  Hop 2: Explain       ──→  Gemini API (structured JSON)  │ │
│  │           ↓                                              │ │
│  │  Hop 3: Translate     ──→  Bhashini / Gemini fallback    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
docexplainer/
├── app/
│   ├── api/
│   │   ├── explain/route.ts    # Standalone explain endpoint
│   │   ├── parse/route.ts      # Standalone PDF parse endpoint
│   │   ├── pipeline/route.ts   # Main pipeline endpoint (parse → explain → translate)
│   │   └── translate/route.ts  # Post-result translation endpoint
│   ├── globals.css             # Global styles + Tailwind imports
│   ├── layout.tsx              # Root HTML layout with SEO metadata
│   └── page.tsx                # Main page (upload, submit, results)
├── components/
│   ├── language-picker.tsx     # Language selection UI
│   ├── result-view.tsx         # Full result display with language tabs
│   ├── risk-flag.tsx           # Color-coded risk flag card
│   └── upload-zone.tsx         # Drag-and-drop PDF upload
├── lib/
│   ├── bhashini.ts             # Translation adapter (Bhashini + Gemini fallback)
│   ├── domain-templates.ts     # Domain classifier + per-domain prompts
│   ├── gemini-client.ts        # Shared Gemini client (key rotation + retry)
│   ├── gemini.ts               # Document explanation via Gemini
│   ├── pdf.ts                  # PDF text extraction via pdf-parse
│   ├── pipeline.ts             # Orchestration pipeline (chains all 3 hops)
│   └── types.ts                # Shared TypeScript type definitions
├── .env.local                  # API keys (not committed)
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS theme customization
├── tsconfig.json               # TypeScript configuration
├── postcss.config.js           # PostCSS + Autoprefixer config
└── package.json                # Dependencies and scripts
```

---

## Pipeline Flow

The core of the project is a **3-hop orchestration pipeline** with per-hop timing and fallback tracking:

### Hop 1: Parse (pdf-parse — local)
```
PDF Buffer → pdf-parse → { text, pageCount, isScanned }
```
- Runs locally on the server, no API call
- ~200-500ms typical latency
- Detects scanned PDFs (< 50 chars/page)

### Safety Gate: Domain Classification
```
text → keyword matching → medical | legal | financial | government | REJECTED
```
- Counts keyword hits per domain
- Requires ≥2 keyword matches to classify
- Rejects non-matching documents with HTTP 422

### Hop 2: Explain (Gemini API)
```
text + domain prompt → Gemini → JSON { title, summary, keyTerms, riskFlags, actionItems }
```
- Uses domain-specific prompts (medical emphasizes lab values, legal emphasizes clause risks)
- Output is validated and coerced to the ExplainedDoc schema
- ~3-5 seconds typical latency

### Hop 3: Translate (Bhashini / Gemini)
```
ExplainedDoc → Bhashini or Gemini → TranslatedDoc with per-language views
```
- Bhashini for Hindi/Bengali (if API keys configured), Gemini as fallback
- Entire document translated as a single JSON payload (not per-field)
- ~4-8 seconds typical latency per language

---

## API Routes

### `POST /api/pipeline` — Main Endpoint
**Input:** `FormData` with `file` (PDF) and `languages` (JSON array)
**Output:** `{ data: TranslatedDoc, meta: PipelineMetadata }`
**Timeout:** 60 seconds

### `POST /api/translate` — Add Translation Post-Result
**Input:** `{ doc: ExplainedDoc, languages: ["hi"] }`
**Output:** `{ translated: TranslatedDoc, fallbacks: string[] }`
**Timeout:** 45 seconds

### `POST /api/parse` — Standalone Parse
**Input:** `FormData` with `file` (PDF)
**Output:** `{ text, pageCount, isScanned }`

### `POST /api/explain` — Standalone Explain
**Input:** `{ text: string }`
**Output:** `ExplainedDoc`

---

## Key Algorithms & Logic

### API Key Rotation (lib/gemini-client.ts)
- Supports up to 5 Gemini API keys for round-robin rotation
- On quota exhaustion (429), transparently rotates to the next key
- On model unavailability (limit: 0), blacklists the model globally
- On transient overload (503), retries with 2.5-second backoff
- If all keys fail, waits 3 seconds and does a full second pass

### Domain Classification (lib/domain-templates.ts)
- Keyword-based heuristic classifier
- 4 domains with ~15 domain-specific keywords each
- Counts keyword hits, picks highest-scoring domain
- Minimum 2 hits required (prevents false positives)

### Batched Translation (lib/bhashini.ts)
- Sends the entire ExplainedDoc structure as a JSON payload
- Gemini translates all string values in a single API call
- Reduces API calls from ~25 per language to just 1
- Validates and coerces the returned JSON to prevent rendering errors

---

## Environment Variables

| Variable            | Required | Purpose                                     |
| ------------------- | -------- | ------------------------------------------- |
| `GEMINI_API_KEY`    | Yes      | Primary Gemini API key                      |
| `GEMINI_API_KEY_2`  | No       | Second key for rotation                     |
| `GEMINI_API_KEY_3`  | No       | Third key for rotation                      |
| `GEMINI_API_KEY_4`  | No       | Fourth key for rotation                     |
| `GEMINI_API_KEY_5`  | No       | Fifth key for rotation                      |
| `BHASHINI_API_KEY`  | No       | Bhashini API key (falls back to Gemini)     |
| `BHASHINI_USER_ID`  | No       | Bhashini user ID (required with API key)    |

Get a free Gemini API key at: https://aistudio.google.com/apikey

---

## Setup & Installation

```bash
# 1. Clone the repository
git clone https://github.com/ishowguts/docexplainer.git
cd docexplainer

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local and add your Gemini API key(s)

# 4. Run development server
npm run dev
# Open http://localhost:3000

# 5. Build for production
npm run build
npm start
```

---

## Supported Document Types

| Domain     | Examples                                              |
| ---------- | ----------------------------------------------------- |
| Medical    | Lab reports, prescriptions, discharge summaries       |
| Legal      | Rent agreements, contracts, consumer notices          |
| Financial  | Loan papers, EMI schedules, insurance policies        |
| Government | RTI replies, scheme forms, government notices         |

---

## Supported Languages

| Language  | Code       | Backend              | Script     |
| --------- | ---------- | -------------------- | ---------- |
| English   | `en`       | Source (Gemini)       | Latin      |
| Hindi     | `hi`       | Bhashini / Gemini    | Devanagari |
| Hinglish  | `hinglish` | Gemini               | Roman      |
| Bengali   | `bn`       | Bhashini / Gemini    | Bengali    |

---

*DocExplainer · BTP Minor Project · Bittu Mandal · MIS - 112415048*

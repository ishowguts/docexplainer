# DocExplainer — Access, Run, and Deploy Guide

This walks you through every step from "I just downloaded the folder" to
"link is live on the internet and I can show my panel." Follow top to bottom.

Time budget:
- Local run on your laptop: **~10 minutes**
- Live public URL on Vercel: **another ~10 minutes**

---

## 0. What you're about to run

A Next.js 14 web app with three API hops:

```
 PDF  →  pdf-parse  →  Gemini  →  Bhashini  →  Output
         (extract)   (explain) (translate)
```

The only API that *must* work is Gemini. Bhashini is optional — if you skip
its setup, the pipeline falls back to Gemini for translation and shows
`fallback: bhashini→gemini` in the UI telemetry strip.

---

## 1. Prerequisites (install these once)

You need three things on your computer before you can even run `npm install`.

### 1.1 Node.js 18.17 or newer

Check first:

```bash
node --version
```

If it prints `v18.17.x` or higher (ideally `v20.x`), you're done. Otherwise:

- **Windows / macOS:** Download the **LTS** installer from
  <https://nodejs.org/en/download>. Click through, accept defaults.
- **Ubuntu / Debian:**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

After installing, open a **new** terminal window and re-check `node --version`.

### 1.2 Git (optional but recommended)

```bash
git --version
```

If not installed: <https://git-scm.com/downloads>. You'll need this for the
Vercel deploy later.

### 1.3 A code editor

VS Code is the easy pick: <https://code.visualstudio.com/>. You can read/edit
`.env.local` and the code from the same window.

---

## 2. Get the project onto your machine

The folder `docexplainer/` is already on your computer (in your workspace).
Open a terminal and `cd` into it:

```bash
cd "/path/to/docexplainer"
```

Sanity-check you're in the right place:

```bash
ls
# you should see:  app  components  lib  package.json  README.md  ...
```

---

## 3. Install dependencies

One command, pulls down Next.js, React, Tailwind, the Gemini SDK, pdf-parse,
and everything else listed in `package.json`:

```bash
npm install
```

This takes **2-4 minutes** the first time. You may see a few `npm warn`
lines — those are safe to ignore.

After it finishes you'll have a new `node_modules/` folder. Don't delete it.

---

## 4. Get a free Gemini API key

This is the one required credential.

1. Go to <https://aistudio.google.com/apikey>.
2. Sign in with any Google account.
3. Click **"Create API key"**. Pick any project (or "create new project" if
   it's your first time).
4. Copy the long string that starts with `AIza…`. **Do not share or commit
   this key anywhere public.**

Free tier: 15 requests/min, no credit card required. More than enough for
a demo.

---

## 5. (Optional) Get Bhashini credentials

**Skip this section on first run.** Come back to it if you want the "full"
architecture story in your BTP demo (i.e. real Bhashini translation instead
of Gemini fallback).

1. Register at <https://bhashini.gov.in/ulca/user/register>.
2. After email verification, log in to the ULCA dashboard.
3. Create a new **API key** and note the `userID` next to it.
4. You'll use these in the next step.

If any of this is slow or confusing, just skip — the app runs perfectly fine
without Bhashini, and the UI openly shows the fallback route.

---

## 6. Create your `.env.local` file

In the `docexplainer/` folder, there is a file called `.env.example`. Copy it
to `.env.local`:

- **macOS / Linux:**
  ```bash
  cp .env.example .env.local
  ```
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env.local
  ```

Now open `.env.local` in your editor and fill it in:

```env
# REQUIRED — paste the key you copied from aistudio.google.com
GEMINI_API_KEY=AIzaSy...your_long_key_here...

# OPTIONAL — extra Gemini keys for quota-exhaustion rotation.
# The app tries GEMINI_API_KEY first, and cycles to _2, _3, _4, _5
# automatically whenever a key returns 429 / quota-exceeded.
# Tip: create each key from a different Google account to multiply
# your free-tier daily budget.
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_API_KEY_4=
GEMINI_API_KEY_5=

# OPTIONAL — only fill if you did Step 5
BHASHINI_API_KEY=
BHASHINI_USER_ID=
```

Save the file.

> **Never commit `.env.local` to Git.** It is already listed in `.gitignore`.

### Why multiple Gemini keys?

The Gemini free tier caps you at a small number of requests per day per key
(currently ~10/day for `gemini-2.5-flash-lite`). One demo session can burn
through that. By adding 2-3 extra keys from different Google accounts, the
pipeline transparently rotates to the next key when the current one hits
its cap — you never see a "quota exceeded" error mid-demo. Each rotation
is surfaced in the telemetry strip under the result (e.g. `gemini:key2/…`
or `gemini:key1-exhausted→rotating`) so it's visible as a Dev+API talking
point rather than a failure mode.

---

## 7. Run locally

```bash
npm run dev
```

You should see something like:

```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.4s
```

Open <http://localhost:3000> in your browser.

**Test the pipeline:**

1. Pick one or more target languages from the chip row (English is on by
   default; add Hindi / Hinglish / Bengali if you want).
2. Drag any PDF onto the upload zone. Try a rent agreement, lab report, or
   an insurance policy PDF. You'll see a file-preview card with the
   filename and size — **nothing runs yet**.
3. Click **Submit for analysis** to actually kick off the pipeline. (Use
   *Change file* to swap PDFs before submitting.)
4. Wait ~10-20 seconds. You'll see the status text update through each hop.
5. Scroll down to see the summary, risk flags, action items, and glossary.
6. If you picked extra languages, language tabs appear in the result header —
   click them to switch views.
7. Missed a language? Under the telemetry strip there's a **"Translate to"**
   row with chips for any language you didn't already pick. Clicking one
   translates the existing result in-place — **no need to re-upload the PDF**.
8. The telemetry strip under the title shows per-hop latency, Gemini key
   rotation events, and any Bhashini→Gemini fallbacks used.

To stop the dev server: press **Ctrl + C** in the terminal.

---

## 8. Common local errors and fixes

| What you see | What's wrong | Fix |
|---|---|---|
| `GEMINI_API_KEY not set` | No env file, or the key line is commented out | Check `.env.local` exists; restart `npm run dev` after editing |
| `Could not extract text from PDF` | The PDF is an image scan, not real text | Try a different PDF. Text-based PDFs work; scanned photos need OCR (roadmap item) |
| `429 Too Many Requests` | Hit Gemini's free-tier rate limit | Add `GEMINI_API_KEY_2..5` in `.env.local` to auto-rotate; or wait 60 seconds and retry |
| `All Gemini API keys and models exhausted` | Every configured key is capped | Add another key in `GEMINI_API_KEY_N`, or wait till the daily reset |
| Port 3000 already in use | Something else is on 3000 | Run `npm run dev -- -p 3001` and open :3001 |
| `Module not found` after pulling new code | New dependency added | Re-run `npm install` |

---

## 9. Deploy to Vercel (gives you a public URL)

Vercel is free for hobby projects. It auto-builds your Next.js app from a
Git repo and gives you `https://docexplainer-yourname.vercel.app`.

### 9.1 Push the code to GitHub

1. Create a free GitHub account at <https://github.com> if you don't have one.
2. Create a new empty repo called `docexplainer`. **Do not** initialize it
   with a README.
3. In your terminal, from inside `docexplainer/`:

   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/docexplainer.git
   git push -u origin main
   ```

4. Refresh GitHub — you should see all your files there.

> **Important:** Double-check that `.env.local` did **not** get pushed. It's
> excluded by `.gitignore`. If you accidentally pushed it, regenerate your
> Gemini key before anything else.

### 9.2 Connect Vercel

1. Go to <https://vercel.com/signup> and sign in **with GitHub**.
2. Click **"Add New Project"**.
3. Pick the `docexplainer` repo from the list → **Import**.
4. Framework preset auto-detects as **Next.js**. Leave everything default.
5. Open the **"Environment Variables"** section and add:

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key from Step 4 |
   | `GEMINI_API_KEY_2` | (optional) second key for rotation |
   | `GEMINI_API_KEY_3` | (optional) third key for rotation |
   | `GEMINI_API_KEY_4` | (optional) fourth key for rotation |
   | `GEMINI_API_KEY_5` | (optional) fifth key for rotation |
   | `BHASHINI_API_KEY` | (optional, from Step 5) |
   | `BHASHINI_USER_ID` | (optional, from Step 5) |

6. Click **"Deploy"**.

It builds for ~2-3 minutes, then gives you a live URL.

### 9.3 Re-deploying after changes

Just `git push` to `main`. Vercel sees the new commit and auto-deploys.

---

## 10. Demo-day checklist (the last 30 minutes before the panel)

- [ ] Confirm `https://your-app.vercel.app` loads.
- [ ] Upload each of your sample PDFs once — lab report, rent agreement,
      insurance, RTI. Make sure all four domain pills show up in the result
      header ("Medical", "Legal", etc.).
- [ ] Pick at least two languages (e.g., Hindi + Hinglish) so the language
      tabs appear in the demo.
- [ ] Note the fastest and slowest totalMs times from a few runs — useful
      to quote on Slide 10 of the deck.
- [ ] Keep a backup PDF ready in case the internet at the demo is flaky.
- [ ] Have the **GitHub repo URL** and **Vercel URL** on the final slide.

---

## 11. What to actually say during the 15-minute presentation

This matches the deck you already have:

1. **Slides 1-3 (Hook + Problem)** — one paragraph per slide, don't read them.
2. **Slide 4 (Live demo)** — open the Vercel URL in a new tab, drop one PDF,
   talk over the loading spinner: *"Hop one is running pdf-parse server-side,
   hop two streams the text to Gemini with a medical-domain prompt, hop
   three translates through Bhashini…"*
3. **Slide 5 (Why not just ChatGPT)** — this is the slide that sells the
   "Dev + API" framing. Hit it hard.
4. **Slides 6-9 (Architecture, Hops 1/2/3)** — walk the pipeline diagram.
5. **Slide 10 (Results)** — quote the telemetry numbers you saw in Step 10.
6. **Slide 11 (Deploy)** — literally point at the Vercel tab you opened.
7. **Slides 12-13 (Tradeoffs + Roadmap + Thank you)** — 45 seconds total.

---

## 12. FAQ

**Q: Do I need a paid Gemini account?**
No. The free tier is enough for demos.

**Q: Will the free Bhashini API work for my demo?**
Bhashini's free ULCA tier is enough for short documents (< 2-3 pages). For
longer docs in the demo, the Gemini fallback actually runs more reliably.
That is *fine* — the fallback chain is part of what you're showing.

**Q: Can I deploy somewhere other than Vercel?**
Yes — any Next.js-capable host works: Netlify, Render, Railway, Fly.io,
self-hosted VPS. Steps differ slightly but the env vars and build command
(`npm run build` then `npm start`) are the same.

**Q: Someone asks "how would you add Tamil / Marathi / Telugu?"**
Say: *"Add the language code to `LanguageCode` in `lib/types.ts`, add an
entry to `BHASHINI_LANGS` in `lib/bhashini.ts`, done. The UI, the API
route, and the schema stay untouched."* That answer alone shows them the
pipeline is the product.

**Q: Can this handle scanned / image-only PDFs?**
Not yet. The roadmap includes a Tesseract.js OCR fallback. For the demo,
use text-based PDFs only.

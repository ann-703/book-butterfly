# Book Butterfly 🦋

A tiny web app that lets a child scan a book cover and find out — in language she understands — whether the book is right for her.

**[Try it live →](https://book-butterfly.vercel.app/)**  
**[Full build writeup →](https://book-butterfly.vercel.app/)** *(Substack)*

---

## The problem

My daughter reads well above her grade level — but reading skill and life stage don't move in sync. Books at her reading level had themes too heavy for a 7-year-old. Books right for her age bored her in ten pages.

No existing tool walks that line. Reading-level labels tell you nothing about content. Review sites like Common Sense Media require the parent to look things up in advance — but the kid is the one standing in the library.

I needed something she could use herself, in the moment, that would give her a verdict she understood — and log everything for me to review.

The UI was designed by my daughter. She came back from Canva with a butterfly whose right antenna glows green for a good book and left antenna glows red for a pass. I built exactly what she handed me.

---

## How it works

Three Gemini API calls, no scraping, no database:

```
Call 1: Photo → Gemini → extract title and author
Call 2: Title/author → Gemini + google_search → fetch Common Sense Media ratings, age range, content warnings
Call 3: Blurb + search context → Gemini → verdict against parent's rules
```

Six screens: butterfly says hi → camera or text input → loading → verdict with reason → "tell Mama what you thought?" → celebration.

One HTML file. One CSS file. One JS file. Under 100KB total. Total monthly cost: $0.

---

## What I learned building it

**List the models, don't guess.** I tried four model names that returned 404 before calling `ListModels` to see what was actually available on my key. Five seconds saved three hours.

**Search grounding beats a pipeline.** One line — `tools: [{ google_search: {} }]` — and the model pulls Common Sense Media ratings itself. No scraping, no database, no maintenance.

**Newer models have hidden token budgets.** JSON responses were getting truncated mid-token. The fix: raise `maxOutputTokens` and set `thinkingBudget: 0` if you don't need the model to reason before answering.

**The prompt is your product.** The UI is a wrapper. The model is infrastructure. The system prompt is where the actual product thinking lives — write rules about *how* themes are handled, not just whether they appear.

**Build the eval loop early.** Every scan logs to a Google Sheet. Once a month, an Apps Script trigger emails me every disagreement as a prompt-improvement worklist. It's not RLHF — it's one parent, a spreadsheet, and a monthly email. But it's a closed loop, which is more than most LLM apps in production have.

---

## Run your own

See [SETUP.md](SETUP.md) for a step-by-step guide (takes about 15 minutes).

You'll need:
- A Gemini API key (Google AI Studio — free tier works)
- A way to deploy (Vercel, Netlify, or just open `index.html` locally)
- A Google Sheet + Apps Script for logging (optional but recommended)

The code is intentionally simple. Fork it, change the system prompt to reflect your own values, and you have a content filter tuned to your family.

---

## Files

| File | What it does |
|---|---|
| `index.html` | The whole app UI |
| `styles.css` | Styles |
| `app.js` | API calls, camera, verdict logic |
| `build.js` | Build script for Vercel |
| `config.example.js` | Template for your API keys |
| `gmail-script.js` | Apps Script for monthly eval digest |
| `vercel.json` | Vercel deployment config |

# PromptCraft — AI Prompt Maker

A minimal, production-ready Next.js app for generating AI prompts using plain English + smart filters.
Supports **Groq** (llama-3.3-70b-versatile) and **Gemini** (gemini-2.0-flash) as backends.

---

## Stack
- **Framework**: Next.js 14 (App Router)
- **AI Providers**: Groq + Gemini (switchable via UI)
- **Styling**: Inline styles + CSS variables (no extra dependencies)

---

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd promptcraft
npm install
```

### 2. Add API keys
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
GROQ_API_KEY=your_groq_api_key_here       # https://console.groq.com
GEMINI_API_KEY=your_gemini_api_key_here   # https://aistudio.google.com
DEFAULT_PROVIDER=groq
```

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

---

## Deploy to Vercel (recommended)

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel dashboard:
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `DEFAULT_PROVIDER`

---

## How the backend works

All AI calls go through `/api/generate` (a Next.js Route Handler).
The API key **never touches the browser** — it stays server-side via `process.env`.

```
Browser → POST /api/generate → Groq or Gemini API → response → Browser
```

The frontend sends:
```json
{
  "goal": "write a cold email...",
  "role": "an expert copywriter",
  "format": "bullet points",
  "tone": "professional and polished",
  "audience": "small business owners",
  "extra": "keep under 150 words",
  "provider": "groq"
}
```

The backend returns:
```json
{
  "prompt": "...",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile"
}
```

---

## Project structure

```
promptcraft/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.js       ← backend (Groq + Gemini)
│   ├── layout.js
│   ├── page.js                ← full UI
│   └── globals.css
├── .env.local.example
├── next.config.mjs
└── package.json
```

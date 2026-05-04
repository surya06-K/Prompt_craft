// app/api/generate/route.js
// Supports: Groq (llama-3.3-70b-versatile) and Gemini (gemini-2.0-flash)

const SYSTEM_PROMPT = `You are a world-class prompt engineer. Given a user's goal and optional filter preferences, craft a precise, ready-to-use AI prompt.

Rules:
- Output ONLY the final prompt text. No preamble, no explanation, no surrounding quotes.
- Write the prompt as instructions directed at an AI assistant.
- Incorporate role, format, tone, and audience naturally — weave them in, don't list them.
- Make it specific, clear, and immediately usable.
- If constraints are given, honor them strictly.`

function buildUserMessage({ goal, role, format, tone, audience, extra }) {
  const filters = [
    role    ? `Role/Persona: Act as ${role}` : '',
    format  ? `Output format: ${format}` : '',
    tone    ? `Tone: ${tone}` : '',
    audience? `Target audience: ${audience}` : '',
    extra   ? `Constraints: ${extra}` : '',
  ].filter(Boolean).join('\n')

  return `User's goal:\n${goal}${filters ? `\n\nFilters:\n${filters}` : ''}\n\nGenerate the prompt now.`
}

// ── Groq ─────────────────────────────────────────────────────────────
async function callGroq(userMessage) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ── Gemini ────────────────────────────────────────────────────────────
async function callGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.candidates[0].content.parts[0].text.trim()
}

// ── Route handler ─────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json()
    const { goal, role, format, tone, audience, extra, provider } = body

    if (!goal || goal.trim().length < 5) {
      return Response.json({ error: 'Goal is required.' }, { status: 400 })
    }

    const selectedProvider = provider || process.env.DEFAULT_PROVIDER || 'groq'
    const userMessage = buildUserMessage({ goal, role, format, tone, audience, extra })

    let result
    if (selectedProvider === 'gemini') {
      result = await callGemini(userMessage)
    } else {
      result = await callGroq(userMessage)
    }

    return Response.json({
      prompt: result,
      provider: selectedProvider,
      model: selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile',
    })

  } catch (err) {
    console.error('[/api/generate]', err.message)
    return Response.json({ error: err.message || 'Something went wrong.' }, { status: 500 })
  }
}

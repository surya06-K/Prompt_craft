// app/api/generate/route.js
const SYSTEM_PROMPT = `You are a precision prompt engineer. Transform a user's goal into a tight, immediately usable AI prompt.

Hard rules:
- Output ONLY the final prompt text. No preamble, no explanation, no surrounding quotes.
- Trade length for precision - a shorter, specific prompt beats a long padded one every time.
- NEVER invent constraints, assumptions, or context the user did not provide.
- Every sentence must earn its place. Cut anything that does not directly improve output quality.
- Constraints must be concrete and measurable: not "manageable chunks" but "30-minute blocks".
- If output format is specified, encode it as a hard structural instruction, not a style suggestion.
- If a language, tool, or context is given, make it explicit — "Java OOP" is not the same as "Python OOP".
- If time or hours are given, anchor the plan to those exact numbers.
- If learning style is given, shape how the AI should present information accordingly.
- Write the prompt as direct instructions to an AI, not a description of what the AI should do.
- Amplify the user's intent. Never project your own assumptions onto it.`

function buildUserMessage({ goal, role, format, tone, audience, extra, context, hoursAvail, learningStyle }) {
  const filters = [
    role          ? `Role: Act as ${role}` : '',
    format        ? `Output format: ${format} — enforce this structure strictly` : '',
    tone          ? `Tone: ${tone}` : '',
    audience      ? `Target audience: ${audience}` : '',
    context       ? `Context / Language / Tool: ${context}` : '',
    hoursAvail    ? `Time available: ${hoursAvail}` : '',
    learningStyle ? `Learning style: ${learningStyle}` : '',
    extra         ? `Hard constraints: ${extra}` : '',
  ].filter(Boolean).join('\n')
  return `User's goal:\n${goal}${filters ? `\n\nPrecision parameters (use every one given, invent none):\n${filters}` : ''}\n\nGenerate the prompt now. Be precise, not padded.`
}

async function callGroq(userMessage) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', temperature: 0.5, max_tokens: 1024, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }] }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Groq error ${res.status}: ${err}`) }
  return (await res.json()).choices[0].message.content.trim()
}

async function callGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: userMessage }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini error ${res.status}: ${err}`) }
  return (await res.json()).candidates[0].content.parts[0].text.trim()
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { goal, role, format, tone, audience, extra, provider, context, hoursAvail, learningStyle } = body
    if (!goal || goal.trim().length < 5) return Response.json({ error: 'Goal is required.' }, { status: 400 })
    const selectedProvider = provider || process.env.DEFAULT_PROVIDER || 'groq'
    const userMessage = buildUserMessage({ goal, role, format, tone, audience, extra, context, hoursAvail, learningStyle })
    const result = selectedProvider === 'gemini' ? await callGemini(userMessage) : await callGroq(userMessage)
    return Response.json({ prompt: result, provider: selectedProvider, model: selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile' })
  } catch (err) {
    console.error('[/api/generate]', err.message)
    return Response.json({ error: err.message || 'Something went wrong.' }, { status: 500 })
  }
}

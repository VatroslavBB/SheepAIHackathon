import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_NVIDIA_API_KEY,
  baseURL: '/nvidia-api/v1',
  dangerouslyAllowBrowser: true,
})

const MODEL = 'meta/llama-3.3-70b-instruct'

function extractText(stream) {
  let text = ''
  for (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? ''
  }
  return text.trim()
}

function parseJSON(raw) {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found')
  return JSON.parse(stripped.slice(start, end + 1))
}

export async function parseIncidentFromText(text) {
  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 256,
    stream: true,
    messages: [
      {
        role: 'system',
        content: `You are a traffic incident parser for Split, Croatia.
Extract incident info from user reports (in Croatian or English).
Reply with ONLY valid JSON, no markdown, no explanation.
Schema: { "type": "jam|accident|closed", "location": "street or area name", "severity": "low|medium|high", "summary": "one sentence in Croatian" }
If location is unclear, use "Nepoznata lokacija".`,
      },
      { role: 'user', content: text },
    ],
  })

  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return parseJSON(extractText(chunks))
}

export async function summarizeCluster(reports) {
  if (!reports.length) return null

  const list = reports
    .map(r => `- ${r.type} at ${r.location} (${r.severity} severity)`)
    .join('\n')

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    stream: true,
    messages: [
      {
        role: 'system',
        content: 'You summarize traffic conditions in Split, Croatia. Write 1-2 sentences in Croatian. Be direct and useful — mention location, severity, and estimated impact. No filler.',
      },
      {
        role: 'user',
        content: `Current reports:\n${list}\n\nWrite a traffic summary.`,
      },
    ],
  })

  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return extractText(chunks)
}

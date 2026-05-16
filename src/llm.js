import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

export async function parseIncidentFromText(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 256,
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

  return JSON.parse(response.choices[0].message.content)
}

export async function summarizeCluster(reports) {
  if (!reports.length) return null

  const list = reports
    .map(r => `- ${r.type} at ${r.location} (${r.severity} severity)`)
    .join('\n')

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 150,
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

  return response.choices[0].message.content
}

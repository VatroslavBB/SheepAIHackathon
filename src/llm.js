import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_NVIDIA_API_KEY,
  baseURL: '/nvidia-api/v1',
  dangerouslyAllowBrowser: true,
})

const MODEL = 'meta/llama-3.3-70b-instruct'

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
  return chunks.map(c => c.choices[0]?.delta?.content ?? '').join('').trim()
}

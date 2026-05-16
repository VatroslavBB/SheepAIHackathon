import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_NVIDIA_API_KEY,
  baseURL: '/nvidia-api/v1',
  dangerouslyAllowBrowser: true,
})

const MODEL = 'meta/llama-3.3-70b-instruct'


export async function summarizeTraffic(reports, vehicles = []) {
  const incidents = reports
    .map(r => `- ${r.type} kod ${r.location} (${r.severity})`)
    .join('\n')

  const activeLines = [...new Set(
    vehicles.filter(v => v.status === 1).map(v => v.line)
  )].sort().join(', ')

  const parts = []
  if (incidents)   parts.push(`Incidenti:\n${incidents}`)
  if (activeLines) parts.push(`Aktivne autobusne linije: ${activeLines}`)
  if (!parts.length) return null

  const res = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: 'Sažmi prometnu situaciju u Splitu u 1-2 rečenice na hrvatskom. Budi konkretan — navedi lokacije problema i koje linije voze. Bez uvoda i filler rečenica.',
      },
      { role: 'user', content: parts.join('\n\n') },
    ],
  })
  return res.choices[0].message.content
}

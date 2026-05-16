import { API_BASE } from './api'

export async function summarizeTraffic(reports, vehicles = []) {
  const res = await fetch(`${API_BASE}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reports, vehicles }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.summary ?? null
}

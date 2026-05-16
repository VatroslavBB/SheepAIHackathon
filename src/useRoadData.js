import { useState, useEffect } from 'react'

const QUERY = `[out:json][timeout:25];
(
  way["highway"="construction"](43.45,16.35,43.57,16.55);
  node["highway"="construction"](43.45,16.35,43.57,16.55);
  way["construction"~"."](43.45,16.35,43.57,16.55);
  node["construction"~"."](43.45,16.35,43.57,16.55);
  way["access"="no"]["highway"](43.45,16.35,43.57,16.55);
  node["barrier"="block"]["highway"](43.45,16.35,43.57,16.55);
);
out center tags;`

// Vite proxy prvi (nema CORS), zatim direktni URL-ovi kao fallback
const INSTANCES = [
  '/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

function toReport(el) {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!lat || !lng) return null

  const tags     = el.tags || {}
  const isAccess = tags.access === 'no'
  const isBlock  = tags.barrier === 'block'

  return {
    id:       `osm-${el.id}`,
    lat,
    lng,
    type:     'closed',
    severity: isAccess || isBlock ? 'high' : 'medium',
    location: tags.name || tags['addr:street'] || '',
    summary:  tags.note || tags.description || 'Radovi ili ograničenje — OpenStreetMap',
    votes:    0,
    auto:     true,
  }
}

async function fetchOverpass() {
  const body = `data=${encodeURIComponent(QUERY)}`
  for (const url of INSTANCES) {
    try {
      const r = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!r.ok) continue
      const data = await r.json()
      return (data.elements || []).map(toReport).filter(Boolean)
    } catch { continue }
  }
  return []
}

export function useRoadData() {
  const [autoReports, setAutoReports] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const reports = await fetchOverpass()
      if (!cancelled) setAutoReports(reports)
    }

    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return autoReports
}

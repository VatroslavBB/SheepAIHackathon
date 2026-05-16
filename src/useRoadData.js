import { useState, useEffect } from 'react'
import { API_BASE } from './api'

// Split bounding box: south, west, north, east
const BBOX = '43.45,16.35,43.57,16.55'

const QUERY = `[out:json][timeout:25];
(
  way["highway"="construction"](${BBOX});
  node["highway"="construction"](${BBOX});
  way["construction"~"."](${BBOX});
  node["construction"~"."](${BBOX});
  way["highway"="road"](${BBOX});
  way["access"="no"]["highway"](${BBOX});
  node["barrier"="block"]["highway"](${BBOX});
);
out center tags;`

function toReport(el) {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!lat || !lng) return null

  const tags = el.tags || {}
  const isAccess = tags.access === 'no'
  const isBlock = tags.barrier === 'block'

  return {
    id: `osm-${el.id}`,
    lat,
    lng,
    type: 'closed',
    severity: isAccess || isBlock ? 'high' : 'medium',
    location: tags.name || tags['addr:street'] || tags.description || 'Radovi na cesti',
    summary: tags.note || tags.description || 'Radovi — OpenStreetMap',
    votes: 0,
    auto: true,
  }
}

export function useRoadData() {
  const [autoReports, setAutoReports] = useState([])

  useEffect(() => {
    let cancelled = false

    function fetchData() {
      fetch(`${API_BASE}/api/overpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY }),
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          const reports = (data.elements || []).map(toReport).filter(Boolean)
          setAutoReports(reports)
        })
        .catch(() => {})
    }

    fetchData()
    const interval = setInterval(fetchData, 10 * 60 * 1000) // refresh every 10 min
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return autoReports
}

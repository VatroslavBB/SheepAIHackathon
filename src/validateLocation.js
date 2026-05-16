const OVERPASS = 'https://overpass-api.de/api/interpreter'

const INVALID_NATURAL  = new Set(['sea', 'bay', 'water', 'wetland', 'wood',
                                   'scrub', 'heath', 'grassland', 'cliff', 'beach', 'sand'])
const INVALID_LANDUSE  = new Set(['forest', 'meadow', 'farmland', 'farmyard',
                                   'orchard', 'vineyard', 'grass', 'cemetery'])
const INVALID_PLACE    = new Set(['sea', 'ocean'])

const TYPE_LABEL = {
  sea: 'more', bay: 'zaljev', water: 'vodu', wetland: 'močvaru',
  wood: 'šumu', forest: 'šumu', scrub: 'šikaru', beach: 'plažu',
  sand: 'pijesak', meadow: 'livadu', farmland: 'polje', grass: 'travnjak',
  cemetery: 'groblje', ocean: 'ocean',
}

function post(query) {
  return fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  }).then(r => r.json())
}

// Returns the invalid area type string, or null if the point is on valid land
async function checkContainingAreas(lat, lng) {
  const data = await post(`[out:json][timeout:8];is_in(${lat},${lng});out tags;`)
  for (const el of data.elements || []) {
    const t = el.tags || {}
    if (INVALID_NATURAL.has(t.natural))  return t.natural
    if (INVALID_LANDUSE.has(t.landuse))  return t.landuse
    if (INVALID_PLACE.has(t.place))      return t.place
    if (t.waterway)                       return 'water'
  }
  return null
}

// Returns true if there is any road within 200 m of the point
async function checkNearRoad(lat, lng) {
  const data = await post(
    `[out:json][timeout:8];way(around:200,${lat},${lng})["highway"];out count;`
  )
  return (data.elements?.[0]?.tags?.total ?? 0) > 0
}

export async function validateLocation(lat, lng, t) {
  try {
    const [invalidType, hasRoad] = await Promise.all([
      checkContainingAreas(lat, lng),
      checkNearRoad(lat, lng),
    ])

    if (invalidType) {
      const areaNames = t?.hints?.areaNames ?? TYPE_LABEL
      const what = areaNames[invalidType] || areaNames['sea']
      const msg = t?.hints?.invalidArea
        ? t.hints.invalidArea(what)
        : `Incident se ne može prijaviti na ${what}.`
      return { valid: false, reason: msg }
    }

    if (!hasRoad) {
      return { valid: false, reason: t?.hints?.notNearRoad ?? 'Odabrana lokacija nije dovoljno blizu ceste.' }
    }

    return { valid: true }
  } catch {
    return { valid: true }
  }
}

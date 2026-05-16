import { useEffect, useState } from 'react'

export function useBikes() {
  const [stations, setStations] = useState([])

  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch('/api/bikes')
        setStations(await r.json())
      } catch { /* backend možda još nije spreman */ }
    }
    poll()
    const id = setInterval(poll, 3 * 60 * 1000)   // osvježi svako 3 min
    return () => clearInterval(id)
  }, [])

  return { stations }
}

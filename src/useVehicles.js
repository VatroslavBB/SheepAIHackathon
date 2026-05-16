import { useEffect, useState } from 'react'

const WS_URL = `ws://${window.location.hostname}:8000/ws/vehicles`

export function useVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [online,   setOnline]   = useState(false)

  useEffect(() => {
    let ws
    let retryTimer

    function connect() {
      try {
        ws = new WebSocket(WS_URL)
      } catch {
        scheduleRetry()
        return
      }

      ws.onopen = () => setOnline(true)

      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data)

        if (msg.type === 'full') {
          // Inicijalno stanje ili 30s sync — zamijeni sve
          setVehicles(msg.data)
        } else if (msg.type === 'update') {
          // Pojedinačno vozilo se pomaknulo — ažuriraj samo njega
          setVehicles(prev => {
            const idx = prev.findIndex(v => v.id === msg.data.id)
            if (idx === -1) return [...prev, msg.data]
            const next = [...prev]
            next[idx] = msg.data
            return next
          })
        }
      }

      ws.onclose = () => {
        setOnline(false)
        scheduleRetry()
      }

      ws.onerror = () => ws.close()
    }

    function scheduleRetry() {
      retryTimer = setTimeout(connect, 4000)
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [])

  return { vehicles, online }
}

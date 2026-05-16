import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import ReportModal from './components/ReportModal'
import VoiceButton from './components/VoiceButton'
import SummaryPanel from './components/SummaryPanel'
import { useReports } from './useReports'
import { useVoice } from './useVoice'
import { parseIncidentFromText } from './llm'

export default function App() {
  const { reports, addReport, upvoteReport } = useReports()
  const [pendingLatlng, setPendingLatlng] = useState(null)
  const [prefilled, setPrefilled] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  const handleMapClick = useCallback((latlng) => {
    setPrefilled(null)
    setPendingLatlng(latlng)
  }, [])

  const handleVoiceResult = useCallback(async (text) => {
    const splitCenter = { lat: 43.5081, lng: 16.4402 }
    setPendingLatlng(splitCenter)
    setModalLoading(true)
    try {
      const parsed = await parseIncidentFromText(text)
      setPrefilled(parsed)
    } catch {
      setPrefilled(null)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const { listening, start: startVoice, stop: stopVoice } = useVoice({ onResult: handleVoiceResult })

  const handleConfirm = useCallback(async (reportData) => {
    setModalLoading(true)
    await addReport(reportData)
    setModalLoading(false)
    setPendingLatlng(null)
    setPrefilled(null)
  }, [addReport])

  const handleCancel = useCallback(() => {
    setPendingLatlng(null)
    setPrefilled(null)
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      <MapView
        reports={reports}
        onMapClick={handleMapClick}
        onUpvote={upvoteReport}
      />

      <SummaryPanel reports={reports} />

      <VoiceButton
        listening={listening}
        onClick={listening ? stopVoice : startVoice}
      />

      {!reports.length && (
        <div style={{
          position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: 'white',
          borderRadius: 20, padding: '8px 18px', fontSize: 13,
          zIndex: 1000, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          Tapni na kartu za prijavu · 🎙️ za glasovnu prijavu
        </div>
      )}

      {pendingLatlng && (
        <ReportModal
          latlng={pendingLatlng}
          prefilled={prefilled}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={modalLoading}
        />
      )}
    </div>
  )
}

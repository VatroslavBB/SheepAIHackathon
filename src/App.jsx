import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import ReportModal from './components/ReportModal'
import SummaryPanel from './components/SummaryPanel'
import { useReports } from './useReports'

export default function App() {
  const { reports, addReport, upvoteReport, votedIds } = useReports()
  const [pendingLatlng, setPendingLatlng] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  const handleMapClick = useCallback((latlng) => {
    setPendingLatlng(latlng)
  }, [])

  const handleConfirm = useCallback(async (reportData) => {
    setModalLoading(true)
    await addReport(reportData)
    setModalLoading(false)
    setPendingLatlng(null)
  }, [addReport])

  const handleCancel = useCallback(() => {
    setPendingLatlng(null)
  }, [])

  return (
    <div style={{ height: '100dvh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      <MapView
        reports={reports}
        onMapClick={handleMapClick}
        onUpvote={upvoteReport}
        votedIds={votedIds}
      />

      <SummaryPanel reports={reports} />

      {!reports.length && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: 'white',
          borderRadius: 20, padding: '8px 18px', fontSize: 13,
          zIndex: 1000, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          Tapni na kartu za prijavu incidenta
        </div>
      )}

      {pendingLatlng && (
        <ReportModal
          latlng={pendingLatlng}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={modalLoading}
        />
      )}
    </div>
  )
}

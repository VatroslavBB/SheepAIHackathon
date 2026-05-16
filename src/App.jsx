import { useState, useCallback, useMemo } from 'react'
import MapView       from './components/MapView'
import ChatPanel     from './components/ChatPanel'
import ReportModal   from './components/ReportModal'
import SummaryPanel  from './components/SummaryPanel'
import PinLabelModal from './components/PinLabelModal'
import { useVehicles } from './useVehicles'
import { useReports }  from './useReports'
import { useRoadData } from './useRoadData'

export default function App() {
  const { vehicles, online } = useVehicles()
  const { reports, addReport, upvoteReport } = useReports()
  const autoReports = useRoadData()
  const allReports = useMemo(() => [...reports, ...autoReports], [reports, autoReports])

  const [pins,         setPins]         = useState([])
  const [pinMode,      setPinMode]      = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [pendingPin,   setPendingPin]   = useState(null)
  const [pendingReport, setPendingReport] = useState(null)
  const [modalLoading,  setModalLoading]  = useState(false)

  const handleMapClick = useCallback((latlng) => {
    if (pinMode) {
      setPendingPin(latlng)
      setPinMode(false)
    } else {
      setPendingReport(latlng)
    }
  }, [pinMode])

  const handleReportConfirm = useCallback(async (data) => {
    setModalLoading(true)
    await addReport(data)
    setModalLoading(false)
    setPendingReport(null)
  }, [addReport])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation({ lat: coords.latitude, lng: coords.longitude }),
      (err)        => alert('Lokacija nedostupna: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const activeBuses = vehicles.filter(v => v.status === 1).length
  const lineCount   = new Set(vehicles.map(v => v.line)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#151820', borderBottom: '1px solid #1e2330',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)', zIndex: 1200,
      }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#22d3ee', letterSpacing: '0.08em' }}>
          SPLIT // PROMETNI AGENT
        </span>

        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#64748b' }}>
          <span>VOZILA <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{vehicles.length}</span></span>
          <span>LINIJA <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{lineCount}</span></span>
          {reports.length > 0 && (
            <span>INCIDENTI <span style={{ color: '#fbbf24', fontWeight: 500 }}>{reports.length}</span></span>
          )}
          {autoReports.length > 0 && (
            <span>RADOVI <span style={{ color: '#f97316', fontWeight: 500 }}>{autoReports.length}</span></span>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#64748b' }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: online ? '#22c55e' : '#64748b',
            boxShadow: online ? '0 0 6px #22c55e88' : 'none',
          }} />
          <span>{online ? `${activeBuses} u vožnji` : 'offline'}</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <MapView
            vehicles={vehicles}
            reports={allReports}
            userLocation={userLocation}
            pins={pins}
            onMapClick={handleMapClick}
            onUpvote={upvoteReport}
          />

          <div className="map-toolbar">
            <button
              className={`map-btn ${userLocation ? 'active' : ''}`}
              onClick={handleLocate}
              title="Moja lokacija"
            >📍</button>
            <button
              className={`map-btn ${pinMode ? 'active' : ''}`}
              onClick={() => setPinMode(m => !m)}
              title="Dodaj navigacijski pin"
            >📌</button>
            <button
              className="map-btn"
              onClick={() => { setPins([]); setUserLocation(null); setPinMode(false) }}
              title="Obriši pinove i lokaciju"
            >✕</button>
          </div>

          {pinMode && (
            <div style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(124,58,237,0.9)', color: '#fff', borderRadius: 20,
              padding: '6px 16px', fontSize: 13, zIndex: 800, pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              Klikni na kartu za dodavanje pina
            </div>
          )}

          <SummaryPanel reports={allReports} vehicles={vehicles} />

          {!reports.length && !pinMode && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.65)', color: '#e2e8f0', borderRadius: 20,
              padding: '7px 18px', fontSize: 12, zIndex: 800, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              Klikni na kartu za prijavu incidenta
            </div>
          )}
        </div>

        <ChatPanel userLocation={userLocation} pins={pins} reports={allReports} />
      </div>

      {pendingReport && (
        <ReportModal
          latlng={pendingReport}
          loading={modalLoading}
          onConfirm={handleReportConfirm}
          onCancel={() => setPendingReport(null)}
        />
      )}

      {pendingPin && (
        <PinLabelModal
          onConfirm={label => { setPins(p => [...p, { ...pendingPin, label }]); setPendingPin(null) }}
          onCancel={() => setPendingPin(null)}
        />
      )}
    </div>
  )
}

import { useState, useCallback, useMemo } from 'react'
import MapView       from './components/MapView'
import ChatPanel     from './components/ChatPanel'
import ReportModal   from './components/ReportModal'
import SummaryPanel  from './components/SummaryPanel'
import PinLabelModal from './components/PinLabelModal'
import { useVehicles }      from './useVehicles'
import { useReports }       from './useReports'
import { useBikes }         from './useBikes'
import { useRoadData }      from './useRoadData'
import { validateLocation } from './validateLocation'
import { useLang }          from './LangContext'

export default function App() {
  const { lang, setLang, t } = useLang()
  const { vehicles, online } = useVehicles()
  const { reports, addReport, upvoteReport, votedIds } = useReports()
  const { stations: bikes } = useBikes()
  const autoReports = useRoadData()
  const allReports = useMemo(() => [...reports, ...autoReports], [reports, autoReports])

  const [pins,          setPins]          = useState([])
  const [pinMode,       setPinMode]       = useState(false)
  const [userLocation,  setUserLocation]  = useState(null)
  const [pendingPin,    setPendingPin]    = useState(null)
  const [pendingReport, setPendingReport] = useState(null)
  const [modalLoading,  setModalLoading]  = useState(false)
  const [validating,    setValidating]    = useState(false)
  const [locationError, setLocationError] = useState(null)

  const handleMapClick = useCallback(async (latlng) => {
    if (pinMode) {
      setPendingPin(latlng)
      setPinMode(false)
      return
    }

    setValidating(true)
    const result = await validateLocation(latlng.lat, latlng.lng, t)
    setValidating(false)

    if (!result.valid) {
      setLocationError(result.reason)
      setTimeout(() => setLocationError(null), 3500)
      return
    }

    setPendingReport(latlng)
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
          {t.header.title}
        </span>

        <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#64748b' }}>
          <span>{t.header.vehicles} <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{vehicles.length}</span></span>
          <span>{t.header.lines} <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{lineCount}</span></span>
          {reports.length > 0 && (
            <span>{t.header.incidents} <span style={{ color: '#fbbf24', fontWeight: 500 }}>{reports.length}</span></span>
          )}
          {autoReports.length > 0 && (
            <span>{t.header.works} <span style={{ color: '#f97316', fontWeight: 500 }}>{autoReports.length}</span></span>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#64748b' }}>
          <button
            onClick={() => setLang(lang === 'hr' ? 'en' : 'hr')}
            style={{
              background: 'none', border: '1px solid #334155', borderRadius: 6,
              color: '#94a3b8', fontSize: 11, fontFamily: 'DM Mono, monospace',
              padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.06em',
            }}
          >
            {lang === 'hr' ? 'EN' : 'HR'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: online ? '#22c55e' : '#64748b',
              boxShadow: online ? '0 0 6px #22c55e88' : 'none',
            }} />
            <span>{online ? `${activeBuses} ${t.header.driving}` : t.header.offline}</span>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
          <MapView
            vehicles={vehicles}
            reports={allReports}
            bikes={bikes}
            userLocation={userLocation}
            pins={pins}
            onMapClick={handleMapClick}
            onUpvote={upvoteReport}
            votedIds={votedIds}
          />

          <div className="map-toolbar">
            <button className={`map-btn ${userLocation ? 'active' : ''}`} onClick={handleLocate} title={t.toolbar.locate}>📍</button>
            <button className={`map-btn ${pinMode ? 'active' : ''}`} onClick={() => setPinMode(m => !m)} title={t.toolbar.pin}>📌</button>
            <button className="map-btn" onClick={() => { setPins([]); setUserLocation(null); setPinMode(false) }} title={t.toolbar.clear}>✕</button>
          </div>

          {validating && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(21,24,32,0.92)', color: '#e2e8f0', borderRadius: 20,
              padding: '7px 18px', fontSize: 12, zIndex: 900, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {t.hints.validating}
            </div>
          )}

          {locationError && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(220,38,38,0.93)', color: '#fff', borderRadius: 20,
              padding: '8px 20px', fontSize: 13, fontWeight: 600,
              zIndex: 900, whiteSpace: 'nowrap', pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              ⚠️ {locationError}
            </div>
          )}

          {pinMode && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(124,58,237,0.9)', color: '#fff', borderRadius: 20,
              padding: '6px 16px', fontSize: 13, zIndex: 800, pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              {t.hints.pinMode}
            </div>
          )}

          <SummaryPanel reports={allReports} vehicles={vehicles} />

          {!reports.length && !pinMode && !validating && !locationError && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.65)', color: '#e2e8f0', borderRadius: 20,
              padding: '7px 18px', fontSize: 12, zIndex: 800, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {t.hints.clickToReport}
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

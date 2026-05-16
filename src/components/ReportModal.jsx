import { useState, useEffect } from 'react'

const TYPES = [
  { value: 'jam',      label: 'Gužva',     emoji: '🚗' },
  { value: 'accident', label: 'Nesreća',   emoji: '🚨' },
  { value: 'closed',   label: 'Zatvoreno', emoji: '🚧' },
]
const SEVERITIES = [
  { value: 'low',    label: 'Mala' },
  { value: 'medium', label: 'Srednja' },
  { value: 'high',   label: 'Visoka' },
]

export default function ReportModal({ latlng, prefilled, onConfirm, onCancel, loading }) {
  const [type,     setType]     = useState(prefilled?.type     || 'jam')
  const [severity, setSeverity] = useState(prefilled?.severity || 'medium')
  const [location, setLocation] = useState(prefilled?.location || '')
  const [summary,  setSummary]  = useState(prefilled?.summary  || '')

  useEffect(() => {
    if (prefilled) {
      setType(prefilled.type       || 'jam')
      setSeverity(prefilled.severity || 'medium')
      setLocation(prefilled.location || '')
      setSummary(prefilled.summary   || '')
    }
  }, [prefilled])

  const typeBtn = (active) => ({
    flex: 1, padding: '10px 4px',
    border: `2px solid ${active ? '#3b82f6' : '#1e2330'}`,
    borderRadius: 8, background: active ? '#1e3a5f' : '#0d0f12',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: active ? '#60a5fa' : '#94a3b8',
  })
  const sevBtn = (active) => ({
    flex: 1, padding: '8px 4px',
    border: `2px solid ${active ? '#3b82f6' : '#1e2330'}`,
    borderRadius: 8, background: active ? '#1e3a5f' : '#0d0f12',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: active ? '#60a5fa' : '#94a3b8',
  })

  return (
    <div
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}
    >
      <div style={{ background: '#151820', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 480, border: '1px solid #1e2330', borderBottom: 'none' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#e2e8f0' }}>Prijavi incident</h2>
        <form onSubmit={e => { e.preventDefault(); onConfirm({ lat: latlng.lat, lng: latlng.lng, type, severity, location, summary }) }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} style={typeBtn(type === t.value)}>
                {t.emoji}<br />{t.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#94a3b8' }}>Lokacija</label>
          <input
            value={location} onChange={e => setLocation(e.target.value)}
            placeholder="npr. Solinska cesta, Kopilica..." required
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #1e2330', borderRadius: 8, fontSize: 14, marginBottom: 14, background: '#0d0f12', color: '#e2e8f0' }}
          />

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#94a3b8' }}>Ozbiljnost</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {SEVERITIES.map(s => (
              <button key={s.value} type="button" onClick={() => setSeverity(s.value)} style={sevBtn(severity === s.value)}>
                {s.label}
              </button>
            ))}
          </div>

          {summary && (
            <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#86efac', marginBottom: 16 }}>
              {summary}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onCancel}
              style={{ flex: 1, padding: 12, border: '1px solid #1e2330', borderRadius: 8, background: '#0d0f12', cursor: 'pointer', fontSize: 15, color: '#94a3b8' }}>
              Odustani
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: 12, border: 'none', borderRadius: 8, background: '#2563eb', color: 'white', cursor: loading ? 'wait' : 'pointer', fontSize: 15, fontWeight: 600 }}>
              {loading ? 'Šaljem...' : 'Pošalji'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

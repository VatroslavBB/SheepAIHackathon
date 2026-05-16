import { useState } from 'react'

const TYPES = [
  { value: 'jam',      label: 'Gužva',      emoji: '🚗' },
  { value: 'accident', label: 'Nesreća',    emoji: '🚨' },
  { value: 'closed',   label: 'Zatvoreno',  emoji: '🚧' },
]

const SEVERITIES = [
  { value: 'low',    label: 'Mala' },
  { value: 'medium', label: 'Srednja' },
  { value: 'high',   label: 'Visoka' },
]

export default function ReportModal({ latlng, prefilled, onConfirm, onCancel, loading }) {
  const [type, setType] = useState(prefilled?.type || 'jam')
  const [severity, setSeverity] = useState(prefilled?.severity || 'medium')
  const [location, setLocation] = useState(prefilled?.location || '')
  const [summary, setSummary] = useState(prefilled?.summary || '')

  function handleSubmit(e) {
    e.preventDefault()
    onConfirm({ lat: latlng.lat, lng: latlng.lng, type, severity, location, summary })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'white', borderRadius: '16px 16px 0 0',
        padding: 24, width: '100%', maxWidth: 480,
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Prijavi incident</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                style={{
                  flex: 1, padding: '10px 4px', border: '2px solid',
                  borderColor: type === t.value ? '#2563eb' : '#e5e7eb',
                  borderRadius: 8, background: type === t.value ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {t.emoji}<br />{t.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Lokacija
          </label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="npr. Solinsk cesta, Kopilica..."
            required
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
              marginBottom: 14,
            }}
          />

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Ozbiljnost
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {SEVERITIES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                style={{
                  flex: 1, padding: '8px 4px', border: '2px solid',
                  borderColor: severity === s.value ? '#2563eb' : '#e5e7eb',
                  borderRadius: 8, background: severity === s.value ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {summary ? (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 8, padding: '10px 12px', fontSize: 13,
              color: '#166534', marginBottom: 16,
            }}>
              {summary}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px', border: '1px solid #e5e7eb',
                borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 15,
              }}
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2, padding: '12px', border: 'none',
                borderRadius: 8, background: '#2563eb', color: 'white',
                cursor: loading ? 'wait' : 'pointer', fontSize: 15, fontWeight: 600,
              }}
            >
              {loading ? 'Šaljem...' : 'Pošalji'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

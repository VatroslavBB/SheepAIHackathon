import { useState } from 'react'
import { useLang } from '../LangContext'

export default function ReportModal({ latlng, onConfirm, onCancel, loading }) {
  const { t } = useLang()
  const r = t.report

  const TYPES = [
    { value: 'jam',      emoji: '🚗' },
    { value: 'accident', emoji: '🚨' },
    { value: 'closed',   emoji: '🚧' },
  ]
  const SEVS = ['low', 'medium', 'high']

  const [type,     setType]     = useState('jam')
  const [severity, setSeverity] = useState('medium')
  const [location, setLocation] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onConfirm({ lat: latlng.lat, lng: latlng.lng, type, severity, location, summary: '' })
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
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{r.title}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {TYPES.map(tp => (
              <button
                key={tp.value}
                type="button"
                onClick={() => setType(tp.value)}
                style={{
                  flex: 1, padding: '10px 4px', border: '2px solid',
                  borderColor: type === tp.value ? '#2563eb' : '#e5e7eb',
                  borderRadius: 8, background: type === tp.value ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {tp.emoji}<br />{r.types[tp.value]}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            {r.location}
          </label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder={r.locationPlaceholder}
            required
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 14,
            }}
          />

          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            {r.severity}
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {SEVS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                style={{
                  flex: 1, padding: '8px 4px', border: '2px solid',
                  borderColor: severity === s ? '#2563eb' : '#e5e7eb',
                  borderRadius: 8, background: severity === s ? '#eff6ff' : 'white',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {r.sevs[s]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px', border: '1px solid #e5e7eb',
                borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 15,
              }}
            >
              {r.cancel}
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
              {loading ? r.submitting : r.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'

export default function PinLabelModal({ onConfirm, onCancel }) {
  const [label, setLabel] = useState('')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])

  return (
    <div
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}
    >
      <div style={{ background: '#151820', borderRadius: '16px 16px 0 0', padding: '20px 24px', width: '100%', maxWidth: 440, border: '1px solid #1e2330', borderBottom: 'none' }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#e2e8f0', marginBottom: 12 }}>📌 Dodaj navigacijski pin</div>
        <form onSubmit={e => { e.preventDefault(); onConfirm(label.trim() || 'Odredište') }}>
          <input
            ref={ref}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Oznaka (npr. Posao, Dom, Dućan...)"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #1e2330', borderRadius: 8, fontSize: 14, background: '#0d0f12', color: '#e2e8f0', marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onCancel}
              style={{ flex: 1, padding: 11, border: '1px solid #1e2330', borderRadius: 8, background: '#0d0f12', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>
              Odustani
            </button>
            <button type="submit"
              style={{ flex: 2, padding: 11, border: 'none', borderRadius: 8, background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Dodaj pin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

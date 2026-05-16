import { useEffect, useState } from 'react'
import { summarizeCluster } from '../llm'

export default function SummaryPanel({ reports }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!reports.length) { setSummary(''); return }
    setLoading(true)
    summarizeCluster(reports)
      .then(s => setSummary(s || ''))
      .catch(() => setSummary(''))
      .finally(() => setLoading(false))
  }, [reports.length])

  if (!reports.length) return null

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'white',
      borderRadius: 12,
      padding: '12px 18px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      zIndex: 1000,
      maxWidth: 'calc(100vw - 32px)',
      width: 420,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Prometna situacija · {reports.length} prijava
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: '#9ca3af' }}>Analiziram...</div>
      ) : (
        <div style={{ fontSize: 14, color: '#111', lineHeight: 1.5 }}>{summary}</div>
      )}
    </div>
  )
}

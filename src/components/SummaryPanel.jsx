import { useEffect, useState } from 'react'
import { summarizeTraffic } from '../llm'
import { useLang } from '../LangContext'

export default function SummaryPanel({ reports, vehicles }) {
  const { lang, t } = useLang()
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!reports.length) { setSummary(''); return }
    setLoading(true)
    summarizeTraffic(reports, vehicles, lang)
      .then(s  => setSummary(s || ''))
      .catch(() => setSummary(''))
      .finally(() => setLoading(false))
  }, [reports.length, lang])

  if (!reports.length) return null

  return (
    <div style={{
      position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(21,24,32,0.95)', border: '1px solid #1e2330',
      borderRadius: 12, padding: '10px 16px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 800,
      maxWidth: 'calc(100% - 140px)', width: 400,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4, fontFamily: 'DM Mono, monospace', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {t.summary.label} · {t.summary.incident(reports.length)}
      </div>
      {loading
        ? <div style={{ fontSize: 13, color: '#64748b' }}>{t.summary.analyzing}</div>
        : <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{summary}</div>
      }
    </div>
  )
}

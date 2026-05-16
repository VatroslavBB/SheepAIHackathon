import { useState, useRef, useEffect, useCallback } from 'react'
import { API_BASE } from '../api'
import { useLang } from '../LangContext'

export default function ChatPanel({ userLocation, pins, reports }) {
  const { t } = useLang()
  const c = t.chat
  const [messages, setMessages] = useState([{ role: 'assistant', text: c.welcome }])
  const [history, setHistory]  = useState([])
  const [input,   setInput]    = useState('')
  const [loading, setLoading]  = useState(false)
  const bottomRef              = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text) => {
    if (!text?.trim() || loading) return
    const userText = text.trim()
    setInput('')
    setLoading(true)

    const key = `t-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { role: 'user', text: userText },
      { role: 'thinking', text: '...', key },
    ])

    const nextHistory = [...history, { role: 'user', content: userText }]

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:       userText,
          history:       nextHistory.slice(-12),
          user_location: userLocation,
          pins:          (pins ?? []).map(p => ({ lat: p.lat, lng: p.lng, label: p.label })),
          reports:       reports.slice(0, 10).map(({ type, location, severity, summary, lat, lng }) =>
                           ({ type, location, severity, summary, lat, lng })),
        }),
      })
      const { response } = await res.json()
      setMessages(prev => prev.filter(m => m.key !== key).concat({ role: 'assistant', text: response }))
      setHistory([...nextHistory, { role: 'assistant', content: response }])
    } catch {
      setMessages(prev => prev.filter(m => m.key !== key).concat({ role: 'assistant', text: c.error }))
    }
    setLoading(false)
  }, [loading, history, userLocation, pins, reports])

  return (
    <div className="chat-panel">
      <div className="chat-header">{c.header}</div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={m.key ?? i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="quick-prompts">
        {c.quickPrompts.map(qp => (
          <button key={qp.label} className="qp" onClick={() => send(qp.text)}>{qp.label}</button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder={c.placeholder}
        />
        <button onClick={() => send(input)} disabled={loading}>↑</button>
      </div>
    </div>
  )
}

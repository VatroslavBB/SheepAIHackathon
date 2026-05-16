import { useState, useRef, useEffect, useCallback } from 'react'

const QUICK_PROMPTS = [
  { label: 'Linija 7?',  text: 'Gdje je sada linija 7 i u kojem smjeru ide?' },
  { label: '→ Kampus',   text: 'Koje linije idu prema Kampusu FESB?' },
  { label: '→ Bačvice',  text: 'Koji autobus me može odvesti na Bačvice?' },
  { label: 'Statistika', text: 'Koliko autobusa je aktivno i koje linije voze?' },
]

export default function ChatPanel({ userLocation, pins, reports }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Zdravo! Pitaj me o autobusima u Splitu.\n📍 Tapni za svoju lokaciju → predložit ću najbliže linije\n📌 Dodaj pin odredišta → reći ću ti kako doći tamo',
  }])
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:       userText,
          history:       nextHistory.slice(-12),
          user_location: userLocation,
          pins:          pins.map(p => ({ lat: p.lat, lng: p.lng, label: p.label })),
          reports:       reports.slice(0, 10).map(({ type, location, severity, summary, lat, lng }) =>
                           ({ type, location, severity, summary, lat, lng })),
        }),
      })
      const { response } = await res.json()
      setMessages(prev => prev.filter(m => m.key !== key).concat({ role: 'assistant', text: response }))
      setHistory([...nextHistory, { role: 'assistant', content: response }])
    } catch {
      setMessages(prev => prev.filter(m => m.key !== key).concat({ role: 'assistant', text: 'Greška pri komunikaciji s agentom.' }))
    }
    setLoading(false)
  }, [loading, history, userLocation, pins, reports])

  return (
    <div className="chat-panel">
      <div className="chat-header">AI AGENT // llama-3.1-70b</div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={m.key ?? i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="quick-prompts">
        {QUICK_PROMPTS.map(qp => (
          <button key={qp.label} className="qp" onClick={() => send(qp.text)}>{qp.label}</button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Pitaj o prometu..."
        />
        <button onClick={() => send(input)} disabled={loading}>↑</button>
      </div>
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'

const ERROR_MESSAGES = {
  'not-allowed': 'Dopusti pristup mikrofonu u postavkama preglednika.',
  'no-speech': 'Nije detektiran govor. Pokušaj ponovo.',
  'network': 'Mrežna greška pri prepoznavanju govora.',
  'audio-capture': 'Mikrofon nije pronađen.',
}

export function useVoice({ onResult }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Prepoznavanje govora nije podržano. Koristi Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'hr-HR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = (event) => {
      setListening(false)
      const msg = ERROR_MESSAGES[event.error] || `Greška: ${event.error}`
      alert(msg)
    }
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      onResult(text)
    }

    recognition.start()
  }, [onResult])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, transcript, start, stop }
}

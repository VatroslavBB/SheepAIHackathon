export default function VoiceButton({ listening, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Glasovna prijava"
      style={{
        position: 'fixed',
        bottom: 32,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: '50%',
        border: 'none',
        background: listening ? '#ef4444' : '#2563eb',
        color: 'white',
        fontSize: 26,
        cursor: 'pointer',
        boxShadow: listening
          ? '0 0 0 8px rgba(239,68,68,0.25), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {listening ? '⏹' : '🎙️'}
    </button>
  )
}

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const ICON_MAP = {
  jam:      { emoji: '🚗', color: '#f59e0b' },
  accident: { emoji: '🚨', color: '#ef4444' },
  closed:   { emoji: '🚧', color: '#6b7280' },
}

const SEVERITY_OPACITY = { low: 0.6, medium: 0.85, high: 1.0 }

function makeIcon(type, auto) {
  const { emoji, color } = ICON_MAP[type] || ICON_MAP.jam
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${auto ? '#b45309' : color};
      border-radius:50%;
      width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      border:2px solid ${auto ? '#fde68a' : 'white'};
    ">${auto ? '🔧' : emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) })
  return null
}

const TYPE_LABELS = { jam: 'Gužva', accident: 'Nesreća', closed: 'Zatvoreno' }
const SEVERITY_LABELS = { low: 'Mala', medium: 'Srednja', high: 'Visoka' }

export default function MapView({ reports, onMapClick, onUpvote, votedIds = new Set() }) {
  return (
    <MapContainer
      center={[43.5081, 16.4402]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      {reports.map(report => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={makeIcon(report.type, report.auto)}
          opacity={SEVERITY_OPACITY[report.severity] || 0.85}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {report.auto ? '🔧' : ICON_MAP[report.type]?.emoji} {TYPE_LABELS[report.type] || report.type}
                {report.auto && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '1px 5px' }}>
                    OSM
                  </span>
                )}
              </div>
              <div style={{ color: '#555', marginBottom: 4 }}>{report.location}</div>
              {report.summary && (
                <div style={{ fontSize: 13, marginBottom: 6, color: '#333' }}>{report.summary}</div>
              )}
              <div style={{ fontSize: 12, color: '#888', marginBottom: report.auto ? 0 : 8 }}>
                Ozbiljnost: {SEVERITY_LABELS[report.severity] || report.severity}
                {!report.auto && <>&nbsp;·&nbsp; {report.votes} potvrda</>}
              </div>
              {!report.auto && (
                <button
                  onClick={() => onUpvote(report.id)}
                  disabled={votedIds.has(report.id)}
                  style={{
                    marginTop: 8,
                    background: votedIds.has(report.id) ? '#94a3b8' : '#2563eb',
                    color: 'white', border: 'none',
                    borderRadius: 6, padding: '4px 12px',
                    cursor: votedIds.has(report.id) ? 'default' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {votedIds.has(report.id) ? '✓ Potvrđeno' : '+ Potvrdi'}
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_LABEL  = { 1: 'U vožnji', 3: 'Na stajalištu', 6: 'Izvan usluge' }
const INCIDENT_META = {
  jam:      { emoji: '🚗', color: '#f59e0b', label: 'Gužva' },
  accident: { emoji: '🚨', color: '#ef4444', label: 'Nesreća' },
  closed:   { emoji: '🚧', color: '#6b7280', label: 'Zatvoreno' },
}
const SEV_LABEL = { low: 'Mala', medium: 'Srednja', high: 'Visoka' }

// ── Icon factories ─────────────────────────────────────────────────────────────

function makeBusIcon(v) {
  const cls    = v.status === 1 ? 's1' : v.status === 3 ? 's3' : 's6'
  const moving = v.status === 1 && v.heading != null
  const arrow  = moving
    ? `<div class="bus-arrow-ring" style="transform:rotate(${v.heading}deg)"><div class="bus-arrow-tip"></div></div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div class="bus-wrap">${arrow}<div class="bus-num ${cls}">${v.line}</div></div>`,
    iconSize: [40, 40], iconAnchor: [20, 20],
  })
}

function makeIncidentIcon(type) {
  const { emoji, color } = INCIDENT_META[type] || INCIDENT_META.jam
  return L.divIcon({
    className: '',
    html: `<div class="incident-marker" style="background:${color}">${emoji}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  })
}

const userLocIcon = L.divIcon({
  className: '',
  html: '<div class="user-loc-dot"></div>',
  iconSize: [18, 18], iconAnchor: [9, 9],
})

function makeBikeIcon(station) {
  const available = station.bikes > 0
  const bg        = available ? '#16a34a' : '#94a3b8'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:#fff;width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;line-height:1;
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      cursor:pointer;
    ">🚲</div>`,
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
  })
}

function makePinIcon(label) {
  return L.divIcon({
    className: '',
    html: `<div class="pin-wrap"><div class="pin-label">${label}</div><div class="pin-dot"></div></div>`,
    iconSize: [1, 36], iconAnchor: [0, 36],
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) })
  return null
}

function BusMarker({ vehicle: v }) {
  const icon = useMemo(() => makeBusIcon(v), [v.status, v.heading, v.line])
  return (
    <Marker position={[v.lat, v.lng]} icon={icon}>
      <Popup>
        <div className="popup-line">Linija {v.line}</div>
        <div className="popup-detail">
          <span className={`popup-badge badge-s${v.status}`}>{STATUS_LABEL[v.status] || '?'}</span>
          {v.status === 1 && v.compass && (
            <><br />Smjer: <b>{v.compass}</b>{v.heading != null ? ` (${Math.round(v.heading)}°)` : ''}</>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

function IncidentMarker({ report: r, onUpvote }) {
  const meta = INCIDENT_META[r.type] || INCIDENT_META.jam
  const icon = useMemo(() => makeIncidentIcon(r.type), [r.type])
  return (
    <Marker position={[r.lat, r.lng]} icon={icon} opacity={r.severity === 'low' ? 0.65 : 1}>
      <Popup>
        <div className="popup-line">{meta.emoji} {meta.label}</div>
        <div className="popup-detail">
          {r.location && <>{r.location}<br /></>}
          {r.summary  && <span style={{ color: '#e2e8f0', display: 'block', marginBottom: 4 }}>{r.summary}</span>}
          Ozbiljnost: {SEV_LABEL[r.severity] || r.severity} · {r.votes} potvrda
          <br />
          <button
            onClick={() => onUpvote(r.id)}
            style={{ marginTop: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
          >+ Potvrdi</button>
        </div>
      </Popup>
    </Marker>
  )
}

function BikeMarker({ station: s }) {
  const icon = useMemo(() => makeBikeIcon(s), [s.bikes, s.ebikes])
  return (
    <Marker position={[s.lat, s.lng]} icon={icon}>
      <Popup>
        <div className="popup-line">🚲 {s.name}</div>
        <div className="popup-detail">
          Dostupno: <b>{s.bikes}</b> bicikala
          {s.ebikes > 0 && <> ({s.ebikes} ⚡ e-bicikla)</>}
          <br />Slobodnih mjesta: {s.free_racks}
          <br /><span style={{ color: '#60a5fa', fontSize: 11 }}>
            1 EUR / 30 min · 5 EUR / dan
          </span>
        </div>
      </Popup>
    </Marker>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MapView({ vehicles, reports, bikes, userLocation, pins, onMapClick, onUpvote }) {
  return (
    <MapContainer
      center={[43.508, 16.440]}
      zoom={13}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <ZoomControl position="bottomright" />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
        keepBuffer={4}
      />

      <ClickHandler onMapClick={onMapClick} />

      {vehicles.filter(v => v.status !== 6).map(v => <BusMarker key={v.id} vehicle={v} />)}

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={false}
      >
        {bikes.map(s => <BikeMarker key={s.uid} station={s} />)}
      </MarkerClusterGroup>

      {reports.map(r => <IncidentMarker key={r.id} report={r} onUpvote={onUpvote} />)}

      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocIcon}>
          <Popup><div className="popup-line">📍 Vaša lokacija</div></Popup>
        </Marker>
      )}

      {pins.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={makePinIcon(p.label)}>
          <Popup><div className="popup-line">📌 {p.label}</div></Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

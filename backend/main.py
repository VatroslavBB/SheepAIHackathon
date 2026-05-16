import asyncio
import json
import httpx
import websockets
import math
import re
import tempfile
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # učita backend/.env automatski
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

vehicles: dict = {}
bike_stations: list = []   # Nextbike stanice (osvježava se svako 3 min)


# ── Nextbike ───────────────────────────────────────────────────────────────────

NEXTBIKE_CITIES = [617, 740, 802, 804]   # Split, Solin, Trogir, Kaštela
NEXTBIKE_URL    = "https://api.nextbike.net/maps/nextbike-live.json?city=" + \
                  ",".join(map(str, NEXTBIKE_CITIES))


async def refresh_bikes():
    global bike_stations
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(NEXTBIKE_URL)
            r.raise_for_status()
        data = r.json()
        stations: list = []
        for country in data.get("countries", []):
            for city in country.get("cities", []):
                for place in city.get("places", []):
                    if not place.get("active_place"):
                        continue
                    ebikes = sum(
                        1 for b in place.get("bike_list", [])
                        if b.get("pedelec_battery") is not None
                    )
                    stations.append({
                        "uid":        place["uid"],
                        "name":       place["name"],
                        "lat":        place["lat"],
                        "lng":        place["lng"],
                        "bikes":      place.get("bikes_available_to_rent", 0),
                        "ebikes":     ebikes,
                        "free_racks": max(0, place.get("free_racks", 0)),
                    })
        bike_stations = stations
        print(f"[bikes] Učitano {len(bike_stations)} Nextbike stanica")
    except Exception as e:
        print(f"[bikes] Greška: {e}")


async def bike_refresh_loop():
    while True:
        await refresh_bikes()
        await asyncio.sleep(3 * 60)


# ── Haversine + transport ──────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ     = math.radians(lat2 - lat1)
    dλ     = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_bike_stations(lat: float, lng: float, n: int = 1) -> list:
    active = [s for s in bike_stations if s["bikes"] > 0]
    return sorted(active, key=lambda s: haversine_km(lat, lng, s["lat"], s["lng"]))[:n]


AREAS = [
    ("Trajektna luka",      43.5050, 16.4372),
    ("Riva / Centar",       43.5073, 16.4402),
    ("Pjaca / HNK",         43.5081, 16.4402),
    ("Zapadna obala",       43.5078, 16.4296),
    ("Spinut",              43.5155, 16.4370),
    ("Lora",                43.5095, 16.4265),
    ("Bene",                43.5093, 16.4233),
    ("Zenta",               43.5055, 16.4400),
    ("Gripe / Bolnice",     43.5090, 16.4530),
    ("Zvončac",             43.5048, 16.4345),
    ("Mejaši",              43.5185, 16.4430),
    ("Sirobuja",            43.5265, 16.4355),
    ("Kila",                43.5295, 16.4355),
    ("Brda",                43.5310, 16.4460),
    ("Brnik",               43.5250, 16.4530),
    ("Kopilica",            43.5150, 16.4570),
    ("Pazdigrad",           43.5145, 16.4650),
    ("Kampus / FESB",       43.5130, 16.4655),
    ("Pujanke",             43.5175, 16.4690),
    ("Ravne njive",         43.5200, 16.4665),
    ("Trstenik",            43.5110, 16.4715),
    ("Duilovo",             43.4995, 16.4835),
    ("Žnjan",               43.4958, 16.4748),
    ("Stobreč",             43.4910, 16.4895),
    ("Žrnovnica",           43.5005, 16.5155),
    ("Solin centar",        43.5395, 16.4805),
    ("Vranjic",             43.5295, 16.4750),
    ("Mravince",            43.5465, 16.4755),
    ("Klis",                43.5527, 16.5330),
    ("K. Sućurac",          43.5640, 16.4195),
    ("K. Gomilica",         43.5655, 16.3985),
    ("K. Kambelovac",       43.5660, 16.3880),
    ("K. Lukšić",           43.5645, 16.3740),
    ("K. Stari",            43.5610, 16.3545),
    ("K. Novi",             43.5555, 16.3385),
    ("K. Štafilić",         43.5505, 16.3245),
    ("Trogir",              43.5165, 16.2498),
    ("Podstrana",           43.4845, 16.5225),
    ("Dubrovačka",          43.5210, 16.4505),
]


def coords_to_area(lat: float, lng: float) -> str:
    """Vrati ime najbližeg kvarta za GPS koordinate."""
    best, best_d = "Split", float("inf")
    for name, alat, alng in AREAS:
        d = math.hypot(lat - alat, lng - alng)
        if d < best_d:
            best_d, best = d, name
    return best


def incident_delay_min(reports: list, route_lat: float, route_lng: float,
                       dest_lat: float, dest_lng: float) -> tuple[int, list[str]]:
    """Vrati ukupno kašnjenje u minutama i listu upozorenja za incidente uz rutu."""
    SEVERITY_DELAY = {"low": 5, "medium": 10, "high": 20}
    TYPE_FACTOR    = {"jam": 1.0, "accident": 1.2, "closed": 1.5}
    total_delay    = 0
    warnings: list[str] = []

    for r in reports:
        rlat, rlng = r.get("lat"), r.get("lng")
        if rlat is None or rlng is None:
            continue
        # Provjeri je li incident unutar ~1 km od rute (jednostavna aproksimacija)
        d_from_start = haversine_km(route_lat, route_lng, rlat, rlng)
        d_from_dest  = haversine_km(dest_lat, dest_lng, rlat, rlng)
        route_len    = haversine_km(route_lat, route_lng, dest_lat, dest_lng)
        on_route     = (d_from_start + d_from_dest) < route_len * 1.3 + 1.0

        if on_route:
            sev     = r.get("severity", "low")
            typ     = r.get("type", "jam")
            delay   = round(SEVERITY_DELAY.get(sev, 5) * TYPE_FACTOR.get(typ, 1.0))
            total_delay += delay
            loc     = (r.get("location") or "").strip()
            summary = (r.get("summary") or "").strip()
            emoji   = "🚧" if typ == "closed" else "🚨" if typ == "accident" else "🚗"
            typ_hr  = {"jam": "Gužva", "accident": "Nesreća", "closed": "Zatvoreno"}.get(typ, typ)
            sev_hr  = {"low": "mala", "medium": "srednja", "high": "visoka"}.get(sev, sev)
            # Koristi summary ako lokacija je generična (kratka ili opisna bez mjesta)
            generic = {"radovi na cesti", "cesta", "nepoznata lokacija", "nepoznato", ""}
            opis    = summary if (not loc or loc.lower() in generic or len(loc) < 4) else loc
            warnings.append(f"{emoji} {typ_hr} ({sev_hr}): {opis} — +{delay} min za auto/taxi")

    return total_delay, warnings


def build_transport_context(ulat: float, ulng: float, dlat: float, dlng: float,
                            reports: list | None = None) -> str:
    reports = reports or []
    dist    = haversine_km(ulat, ulng, dlat, dlng)
    lines   = [f"Udaljenost polazište → odredište: {dist:.1f} km", ""]

    # Incident kašnjenje za auto/taxi rutu
    delay_min, incident_warnings = incident_delay_min(reports, ulat, ulng, dlat, dlng)
    if incident_warnings:
        lines.append("⚠️ Aktivni incidenti uz rutu:")
        lines.extend(f"  {w}" for w in incident_warnings)
        lines.append("")

    # Bus
    bus_min = max(5, round(dist / 0.333 + 4))
    # Bus je manje pogođen prometnim gužvama (ima vlastite rute, stajališta)
    bus_delay = round(delay_min * 0.4)
    bus_total = bus_min + bus_delay
    bus_note  = f" (uključuje ~{bus_delay} min zbog incidenata)" if bus_delay else ""
    lines.append(f"🚌 Autobus: ~{bus_total} min{bus_note} | 1.30 EUR (gotovina) / 0.66 EUR (kartica)")

    # Nextbike
    ns_user = nearest_bike_stations(ulat, ulng, 1)
    ns_dest = nearest_bike_stations(dlat, dlng, 1)
    bike_min = max(5, round(dist / 0.2))
    bike_eur = 1.00 if bike_min <= 30 else 2.00

    if ns_user:
        s  = ns_user[0]
        dm = haversine_km(ulat, ulng, s["lat"], s["lng"])
        eb = f", {s['ebikes']} e-bicikala" if s["ebikes"] else ""
        lines.append(
            f"🚲 Nextbike: stanica '{s['name']}' ({dm*1000:.0f} m od tebe) "
            f"— {s['bikes']} bicikala{eb} | ~{bike_min} min | ~{bike_eur:.2f} EUR"
        )
        if ns_dest:
            d  = ns_dest[0]
            dd = haversine_km(dlat, dlng, d["lat"], d["lng"])
            lines.append(
                f"   Vrati kod '{d['name']}' ({dd*1000:.0f} m od odredišta"
                f", {d['free_racks']} slobodnih mjesta)"
            )
    else:
        lines.append("🚲 Nextbike: nema dostupnih bicikala u blizini")

    # Uber / Taxi — uključuje incident kašnjenje za auto rutu
    car_kmh   = 25 if dist < 10 else 50
    drive_min = max(3, round(dist / car_kmh * 60))
    drive_delayed = drive_min + delay_min
    uber_wait = 3
    uber_min  = drive_delayed + uber_wait
    uber_eur  = 2.50 + dist * 0.45
    car_note  = f" (od toga ~{delay_min} min zbog incidenata)" if delay_min else ""
    lines.append(f"🚗 Uber: ~{uber_min} min{car_note} (vožnja ~{drive_delayed} min + ~{uber_wait} min čekanje) | ~{uber_eur:.1f}–{uber_eur+1.5:.1f} EUR")

    cammeo_eur = 1.80 + dist * 0.60
    radio_eur  = 2.00 + dist * 0.55
    lines.append(f"🚕 Taxi: ~{drive_delayed} min vožnje{car_note} | Cammeo ~{cammeo_eur:.1f} EUR | Radio taxi ~{radio_eur:.1f} EUR")

    return "\n".join(lines)


class ConnectionManager:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self._clients = [c for c in self._clients if c is not ws]

    async def broadcast(self, msg: dict):
        dead = []
        for ws in self._clients:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

# Vozni red: linija -> sortirani list polaznih vremena (HH:MM)
schedule_by_line: dict[str, list[str]] = {}
schedule_updated_at: datetime | None = None

NIM_API_KEY = os.getenv("NIM_API_KEY", "")
SIGNALR_BASE = "https://api.promet-split.hr/Fleet/hub/spatial"
SCHEDULE_PDF_URL = (
    "https://www.promet-split.hr/Portals/0/adam/Documents/"
    "S9HqnUXeAkyufONCO6U3Ow/Files/Vozni red od 22.04.2026..pdf"
)

nim_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NIM_API_KEY,
)


# ── Bearing ────────────────────────────────────────────────────────────────────

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dLon = math.radians(lon2 - lon1)
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    y = math.sin(dLon) * math.cos(φ2)
    x = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(dLon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def bearing_to_compass(b: float) -> str:
    pts = ["S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
           "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ"]
    return pts[round(b / 22.5) % 16]


# ── Vozni red (PDF) ────────────────────────────────────────────────────────────

def parse_schedule_text(text: str) -> dict[str, list[str]]:
    """Izvuci polazna vremena po linijama iz raw PDF teksta."""
    result: dict[str, list[str]] = {}
    current_line: str | None = None
    time_re = re.compile(r'\b([0-1]?[0-9]|2[0-3]):[0-5][0-9]\b')
    line_re = re.compile(r'(?:LINIJA|Linija|L\.)\s*([A-Z0-9]+)', re.IGNORECASE)

    for row in text.splitlines():
        m = line_re.search(row)
        if m:
            current_line = m.group(1).upper()
            result.setdefault(current_line, [])
        if current_line:
            for t in time_re.findall(row):
                if t not in result[current_line]:
                    result[current_line].append(t)

    return {k: sorted(v) for k, v in result.items() if v}


async def refresh_schedule():
    global schedule_by_line, schedule_updated_at
    try:
        import pdfplumber
    except ImportError:
        print("[schedule] pdfplumber nije instaliran — instaliraj: pip install pdfplumber")
        return

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
            r = await client.get(SCHEDULE_PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(r.content)
            tmp = f.name

        try:
            pages_text: list[str] = []
            with pdfplumber.open(tmp) as pdf:
                for page in pdf.pages:
                    pages_text.append(page.extract_text() or "")
            schedule_by_line = parse_schedule_text("\n".join(pages_text))
            schedule_updated_at = datetime.now()
            print(f"[schedule] Učitan vozni red — {len(schedule_by_line)} linija")
        finally:
            os.unlink(tmp)

    except Exception as e:
        print(f"[schedule] Greška: {e}")


async def schedule_refresh_loop():
    while True:
        await refresh_schedule()
        await asyncio.sleep(6 * 3600)  # osvježi svako 6h


def upcoming_departures(line: str, n: int = 6) -> list[str]:
    times = schedule_by_line.get(line, [])
    now = datetime.now().strftime("%H:%M")
    future = [t for t in times if t >= now]
    return future[:n] or times[:n]  # ako nema više danas, vrati prve jutarnje


# ── SignalR poller ─────────────────────────────────────────────────────────────

async def signalr_negotiate() -> str:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SIGNALR_BASE}/negotiate?negotiateVersion=1",
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        data = r.json()
        return data.get("connectionToken") or data.get("connectionId", "")


async def signalr_poller():
    while True:
        try:
            token = await signalr_negotiate()
            import urllib.parse
            ws_url = f"wss://api.promet-split.hr/Fleet/hub/spatial?id={urllib.parse.quote(token)}"

            print(f"[poller] Spajam se na {ws_url}")
            async with websockets.connect(
                ws_url,
                additional_headers={"User-Agent": "Mozilla/5.0"},
                ping_interval=30,
            ) as ws:
                await ws.send(json.dumps({"protocol": "json", "version": 1}) + "\x1e")
                handshake = await ws.recv()
                print(f"[poller] Handshake: {handshake}")

                async for raw in ws:
                    for chunk in raw.split("\x1e"):
                        chunk = chunk.strip()
                        if not chunk:
                            continue
                        try:
                            msg = json.loads(chunk)
                        except json.JSONDecodeError:
                            continue

                        if msg.get("target") == "ReceiveVehicleData":
                            v = msg["arguments"][0]
                            vid = v["id"]
                            prev = vehicles.get(vid)

                            new_lat, new_lng = v["latitude"], v["longitude"]

                            # Zadrži stari heading ako se vozilo nije pomaknulo dovoljno
                            heading = prev.get("heading") if prev else None
                            compass = prev.get("compass") if prev else None

                            if prev and v["vehicleStatus"] == 1:
                                dist = math.hypot(new_lat - prev["lat"], new_lng - prev["lng"])
                                if dist > 0.0001:  # ~11 m minimalni pomak
                                    heading = calculate_bearing(prev["lat"], prev["lng"], new_lat, new_lng)
                                    compass = bearing_to_compass(heading)

                            vehicles[vid] = {
                                "id": vid,
                                "line": v["name"],
                                "garage": v["garageNumber"],
                                "status": v["vehicleStatus"],
                                "lat": new_lat,
                                "lng": new_lng,
                                "timestamp": v["timestamp"],
                                "heading": heading,
                                "compass": compass,
                            }
                            await manager.broadcast({"type": "update", "data": vehicles[vid]})

        except Exception as e:
            print(f"[poller] Greška: {e}, restartiram za 5s...")
            await asyncio.sleep(5)


@app.on_event("startup")
async def startup():
    asyncio.create_task(signalr_poller())
    asyncio.create_task(schedule_refresh_loop())
    asyncio.create_task(bike_refresh_loop())


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/vehicles")
def get_vehicles():
    return list(vehicles.values())


@app.get("/api/vehicles/line/{line}")
def get_line(line: str):
    return [v for v in vehicles.values() if v["line"] == line]


@app.get("/api/bikes")
def get_bikes():
    return bike_stations


OVERPASS_QUERY = """[out:json][timeout:25];
(
  way["highway"="construction"](43.45,16.35,43.57,16.55);
  node["highway"="construction"](43.45,16.35,43.57,16.55);
  way["construction"~"."](43.45,16.35,43.57,16.55);
  node["construction"~"."](43.45,16.35,43.57,16.55);
  way["access"="no"]["highway"](43.45,16.35,43.57,16.55);
  node["barrier"="block"]["highway"](43.45,16.35,43.57,16.55);
);
out center tags;"""


OVERPASS_INSTANCES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


@app.get("/api/roaddata")
async def get_roaddata():
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "SplitPrometAgent/1.0"}) as client:
        for url in OVERPASS_INSTANCES:
            try:
                r = await client.post(url, data={"data": OVERPASS_QUERY})
                r.raise_for_status()
                return r.json()
            except Exception:
                continue
    return {"elements": []}


@app.get("/api/schedule/{line}")
def get_schedule(line: str):
    times = schedule_by_line.get(line.upper(), [])
    return {
        "line": line,
        "departures": times,
        "upcoming": upcoming_departures(line.upper()),
        "updated_at": schedule_updated_at.isoformat() if schedule_updated_at else None,
    }


# ── WebSocket: real-time vehicle stream → frontend ────────────────────────────

@app.websocket("/ws/vehicles")
async def ws_vehicles(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Pošalji trenutno stanje odmah pri spajanju
        await ws.send_json({"type": "full", "data": list(vehicles.values())})
        # Svakih 30s pošalji puni snapshot (sinkronizira brisanja/nestanke vozila)
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"type": "full", "data": list(vehicles.values())})
    except (WebSocketDisconnect, Exception):
        manager.disconnect(ws)


# ── Chat ───────────────────────────────────────────────────────────────────────

def build_vehicle_context() -> str:
    if not vehicles:
        return "Nema trenutnih podataka o vozilima."

    now = datetime.now().strftime("%H:%M:%S")
    lines: dict[str, list] = {}
    for v in vehicles.values():
        lines.setdefault(v["line"], []).append(v)

    active_total = sum(1 for v in vehicles.values() if v["status"] == 1)
    parts = [
        f"Praćenih vozila: {len(vehicles)} | U vožnji: {active_total} | Linija: {len(lines)} | Podaci: {now}",
        "",
    ]

    for line_name, vs in sorted(lines.items(), key=lambda x: x[0].zfill(3)):
        active  = [v for v in vs if v["status"] == 1]
        stopped = [v for v in vs if v["status"] == 3]
        off     = [v for v in vs if v["status"] == 6]

        counts = f"{len(active)} u vožnji"
        if stopped: counts += f", {len(stopped)} na stajalištu"
        if off:     counts += f", {len(off)} izvan usluge"

        # Sljedeći polasci iz voznog reda (ako postoje)
        upcoming = upcoming_departures(line_name)
        sched_str = f" | sljedeći polasci: {', '.join(upcoming)}" if upcoming else ""

        parts.append(f"Linija {line_name} [{counts}]{sched_str}:")

        for v in active:
            compass = v.get("compass")
            dir_str = f" smjer {compass}" if compass else ""
            kvart   = coords_to_area(v["lat"], v["lng"])
            parts.append(f"  vozilo u vožnji: {kvart}{dir_str}")

        for v in stopped:
            kvart = coords_to_area(v["lat"], v["lng"])
            parts.append(f"  vozilo na stajalištu: {kvart}")

    return "\n".join(parts)


SYSTEM_PROMPT = """Ti si prometni asistent za javni prijevoz Promet Split.
Odgovaraš na pitanja o trenutnoj lokaciji autobusa, procijenjenim vremenima dolaska i prometnim uvjetima.
Imaš pristup live GPS podacima o svim aktivnim vozilima Promet Split. Koordinate su WGS84 (lat/lng).
Odgovaraj kratko i konkretno, na hrvatskom jeziku. Ako vozilo nije aktivno, reci korisniku.

## Statusovi vozila
1 = u vožnji | 3 = na stajalištu | 6 = izvan usluge / garaža

## Ključne koordinate područja

### Split – kvartovi
- Centar / HNK / Pjaca: 43.5081, 16.4402
- Trajektna luka: 43.5050, 16.4372
- Zapadna obala / Sv. Frane: 43.5078, 16.4296
- Bene / Plaža Bačvice: 43.5020, 16.4440
- Zenta: 43.5055, 16.4400
- Spinut: 43.5155, 16.4370
- Lora: 43.5095, 16.4265
- Mejaši: 43.5185, 16.4430
- Sirobuja: 43.5265, 16.4355
- Brda: 43.5310, 16.4460
- Brnik: 43.5250, 16.4530
- Kila: 43.5295, 16.4355
- Kopilica: 43.5150, 16.4570
- Pazdigrad: 43.5145, 16.4650
- Pujanke: 43.5175, 16.4690
- Kampus (FESB): 43.5130, 16.4655
- Ravne njive: 43.5200, 16.4665
- Trstenik: 43.5110, 16.4715
- Žnjan: 43.4958, 16.4748
- Duilovo: 43.4995, 16.4835
- Zvončac: 43.5048, 16.4345
- Gripe / Bolnice: 43.5090, 16.4530
- Dubrovačka: 43.5210, 16.4505
- Stobreč: 43.4910, 16.4895
- Žrnovnica: 43.5005, 16.5155

### Solin
- Solin centar: 43.5395, 16.4805
- Vranjic: 43.5295, 16.4750
- Japirko: 43.5420, 16.4725
- Ninčevići: 43.5445, 16.4910
- Dračevac: 43.5500, 16.4855
- Mravince: 43.5465, 16.4755
- Klis: 43.5527, 16.5330

### 7 Kaštela (zapad → istok)
- Kaštel Štafilić: 43.5505, 16.3245
- Kaštel Novi: 43.5555, 16.3385
- Kaštel Stari: 43.5610, 16.3545
- Kaštel Lukšić: 43.5645, 16.3740
- Kaštel Kambelovac: 43.5660, 16.3880
- Kaštel Gomilica: 43.5655, 16.3985
- Kaštel Sućurac (Strinje): 43.5640, 16.4195
- Zračna luka Split (Airport): 43.5390, 16.2975

### Trogir i okolica
- Trogir centar: 43.5165, 16.2498
- Seget: 43.5100, 16.2700
- Plano / Primorski dolac: 43.5590, 16.3100

### Ostale destinacije
- Podstrana / Mutogras: 43.4845, 16.5225
- Dugopolje: 43.5945, 16.5970
- Omiš: 43.4435, 16.6908
- Kučine: 43.5690, 16.5195
- Tugare / Naklice: 43.5270, 16.5890

## Točke interesa (POI)

### Split – Kupovina & tržnice
- Gradska tržnica (Pazar): 43.5095, 16.4445
- Joker Kopilica: 43.5145, 16.4562
- Tommy Trstenik: 43.5108, 16.4700
- Mercator / Konzum zona centar: 43.5085, 16.4430
- Brodosplit komercijalna zona: 43.5075, 16.4260

### Split – Zdravstvo
- KBC Split – Firule (Klinički bolnički centar): 43.5042, 16.4543
- Dom zdravlja Split centar: 43.5085, 16.4415

### Split – Obrazovanje
- FESB (Fakultet elektrotehnike, strojarstva i brodogradnje): 43.5135, 16.4666
- Ekonomski fakultet: 43.5090, 16.4460
- Pravni i Filozofski fakultet: 43.5085, 16.4475
- Medicinski fakultet / KBC: 43.5042, 16.4543

### Split – Kultura, sport & znamenitosti
- Dioklecijanova palača – Peristil: 43.5081, 16.4402
- Katedrala sv. Duje: 43.5082, 16.4404
- Zlatna vrata (sjever palače): 43.5090, 16.4407
- Srebrena vrata (istok palače): 43.5081, 16.4415
- Brončana vrata / Riva: 43.5073, 16.4402
- Prokurative – Trg Republike: 43.5078, 16.4394
- Muzej grada Splita: 43.5082, 16.4408
- Meštrović galerija: 43.5098, 16.4265
- Park Marjan: 43.5110, 16.4200
- Stadion Poljud (HNK Hajduk): 43.5188, 16.4338
- Hajdukovo sportsko igralište Neslanovac: 43.5165, 16.4305

### Split – Plaže
- Bačvice: 43.5018, 16.4458
- Firule: 43.5035, 16.4510
- Trstenik plaža: 43.5090, 16.4720
- Žnjan plaža: 43.4958, 16.4748
- Kasjuni: 43.5060, 16.4175
- Bene: 43.5093, 16.4233

### Split – Prijevozni čvorovi
- Autobusni kolodvor: 43.5055, 16.4396
- Trajektna luka: 43.5050, 16.4372
- Željeznica Split: 43.5050, 16.4393

### Solin – POI
- Antički grad Salona: 43.5390, 16.4860
- Gospa od Otoka (crkva): 43.5415, 16.4790
- TC Joker Solin: 43.5380, 16.4960

### 7 Kaštela – POI
- Tvrđava Kaštel Kambelovac: 43.5660, 16.3880
- Crkva sv. Jurja – Kaštel Stari: 43.5610, 16.3545
- Plaža Kaštel Gomilica: 43.5650, 16.3985
- TC Brodotrogir / komercijalna zona Resnik: 43.5390, 16.3000

### Trogir – POI
- Katedrala sv. Lovre (UNESCO): 43.5167, 16.2500
- Kaštel Kamerlengo: 43.5155, 16.2485
- Trg Ivana Pavla II: 43.5165, 16.2498
- Kopnena vrata: 43.5162, 16.2503

## Autobusne linije Promet Split

### Gradske linije (Split)
- L1: Bunje – Poljička – HNK – Dom. rata – Bunje
- L2: Split – Poljička – K. Sućurac (Strinje) – Zračna luka (i obratno)
- L2A: K. Sućurac (Strinje) – Trajektna luka
- L3: Brnik – Brda – Brnik
- L3A: Brnik – Poljička – Brnik
- L5: Dračevac – Poljička – HNK – Dračevac
- L5A: Dračevac – Solin centar – Poljička – HNK
- L6: Kila – Vukovarska – HNK – Kila
- L7: Žnjan – Spinut – Zapadna obala (i obratno)
- L8: Žnjan – Zvončac – Žnjan
- L9: Ravne njive – Trajektna luka – Ravne njive
- L10: Japirko – Bilice – Trajektna luka
- L11: Ravne njive – Pujanke – Kampus – Spinut (i obratno)
- L12: Sv. Frane – Bene – Sv. Frane
- L14: Brda – Kopilica – Dubrovačka – Bolnice – Pazdigrad – Poljička – Žnjan – Duilovo
- L15: Duilovo – Žnjan – Trajektna luka – Duilovo
- L16: Ninčevići – Dom. rata – HNK – Ninčevići
- L17: Spinut – Lora – Kampus – Trstenik (i obratno)
- L18: Sirobuja – Mejaši – HNK – Mejaši – Sirobuja
- L21: Sv. Frane – Zenta – Sv. Frane
- L22: Klis – Split (i obratno)

### Urbane linije (Split – okolica)
- Split – K. Sućurac – Zračna luka (i obratno)
- Split – Klis / Klis kosa (i obratno)
- Split – Vranjic (i obratno)
- Split – Kučine (i obratno)
- Split – Solin – Dračevac (i obratno)
- Split – Podstrana / Mutogras (i obratno)
- Split – Dugopolje (i obratno)
- Split – Koprivno (i obratno)
- Split – Airport – Trogir (i obratno)
- Split – K. Stari – Zračna luka (i obratno)
- Split – Omiš – Ravnički most (i obratno)
- Split – Sitno Gornje – Dubrava (i obratno)
- Split – Tugare – Naklice (i obratno)
- K. Stari – Rudine / Željeznička stanica
- Trogir – Split (direktna)

### Prigradske linije (dalje destinacije)
- Split – Kotlenice – Dolac Donji – Dolac Gornji
- Split – Tugare – Podgrađe – Blato – Šestanovac
- Split – Bisko – Trilj – Grab
- Split – Neorić – Sutina
- Split – Muć – Ogorje / Crivac – Kljaci
- Split – Kljaci – Drniš
- Split – Brštanovo – Nisko
- Split – Konjsko – Lećevica – Kladnjice
- K. Stari – Sitno – Bogdanovići – Malačka – Divojevići
- K. Stari – Malačka – Tešije – Đirlući – Šerići

## Kompas (smjer vožnje)
Live podaci uključuju smjer vožnje svakog vozila kao kompasni azimut (npr. "SI 47°").
- S/SS = sjeverno (prema Solinu, Kaštelima, unutrašnjosti)
- I/II = istočno (prema Žnjanu, Stobreču, Omišu)
- J/JJ = južno (prema moru, trajektnoj luci)
- Z/ZZ = zapadno (prema Trogiru)
Koristi smjer + poziciju za procjenu dolazi li bus prema korisniku ili se udaljava.

## Multimodalni prijevoz — tarife

### 🚌 Autobus (Promet Split)
- Jednokratna karta: 1.30 EUR (plaća se vozaču gotovinom)
- Kartica: 0.66 EUR | Dnevna karta: 4.00 EUR

### 🚲 Nextbike (dijeljenje bicikala)
- Real-time podaci o stanicama dostupni su u kontekstu
- Tarife: 30 min = 1.00 EUR | 60 min = 2.00 EUR | Dnevna = 5.00 EUR | Godišnja = 35 EUR
- E-bicikli (pedelec) dostupni na nekim stanicama — ista cijena, električna asistencija
- Preporuči Nextbike ako stanica ima dostupnih bicikala i udaljenost je <6 km

### 🚗 Uber
- Baza: ~2.50 EUR + ~0.45 EUR/km | Gradska brzina: ~25-30 km/h
- Procjena: 2.50 + (km × 0.45) EUR

### 🚕 Taxi
- Cammeo Split: 1.80 EUR start + 0.60 EUR/km
- Radio taxi Split: 2.00 EUR start + 0.55 EUR/km
- Noćna tarifa (22:00–06:00): +20%

### Preporuke po udaljenosti
- <1 km: pješice (10-15 min) ili Nextbike
- 1–4 km: Nextbike ili autobus (~1.30 EUR)
- 4–10 km: autobus ili Uber (~5–7 EUR)
- >10 km: Uber ili taxi (~8–15 EUR)

## Kako koristiti korisnikovu lokaciju i pinove
- Ako je poznata GPS lokacija korisnika: prepoznaj kvart (usporedi s koordinatama) i predloži najbliže linije.
- Ako je pin postavljen kao odredište: pronađi koji kvart/POI je najbliži pinu i koje linije tamo idu.
- Kombinacija lokacija + odredišni pin: predloži konkretnu rutu (kojom linijom, gdje ukrcati, gdje iskrcati).
- Prevedi koordinate u ime mjesta – nikad ne izgovaraj gole koordinate korisniku.

## Kako odgovarati

UVIJEK govori o LINIJAMA, nikad o ID-u vozila. Korisnik ne zna što je "vozilo #1042".

- Linija s jednim vozilom: "Linija 7 trenutno je kod Žnjana i kreće prema centru."
- Linija s više vozila: opiši svako po lokaciji i smjeru.
- Prevedi koordinate u ime kvarta — nikad ne izgovaraj gole koordinate korisniku.
- Za ETA: procijeni na temelju udaljenosti i smjera (gradski bus ~20 km/h).
- Vozni red: ako su dostupni polasci, navedi ih. Inače uputi na promet-split.hr/vozni-red.
- Ne izmišljaj podatke. Ako linija nema aktivnih vozila, jasno reci.
- ZABRANJENO: ID vozila, broj garaže, lat/lng koordinate, tehničke detalje API-ja.
- Lokaciju vozila UVIJEK pretvori u ime kvarta (npr. "Žnjan", "Kampus", "Trstenik") — kontekst ti daje naziv kvarta za svako vozilo.

## Kad korisnik pita "kako doći" ili "prijevoz"

UVIJEK navedi SVE četiri opcije — autobus, Nextbike, Uber i taxi — čak i ako korisnik pita samo za jednu.
Format odgovora (OBAVEZNO uključi trajanje za svaku opciju):

🚌 Autobus: linija X prema [odredište] — ~X min | 1.30 EUR
🚲 Nextbike: stanica "[naziv]" (Xm), Z bicikala — ~X min vožnje | ~Y EUR
🚗 Uber: ~X min (vožnja ~Y min + ~3 min čekanje) | ~Y–Z EUR
🚕 Taxi: ~X min vožnje | Cammeo ~Y EUR | Radio taxi ~Z EUR

VAŽNO: Za auto/taxi UVIJEK napiši trajanje vožnje u minutama — korisnik želi znati i koliko traje vožnja, a ne samo cijenu.
Ako nema podataka o lokaciji korisnika, svejedno objasni koje linije postoje i nabroji opcije s okvirnim cijenama.

## Nextbike — obavezno preporučaj

Kad korisnik pita za bicikl, **UVIJEK preporuči Nextbike** — to je javni sustav dijeljenja bicikala u Splitu.
Nikad ne pretpostavljaj da korisnik ima vlastiti bicikl — predloži Nextbike kao rješenje.
Real-time podaci o stanicama su dostupni u kontekstu (lokacija, broj bicikala, e-bicikli).
Ako nema dostupnih bicikala na bližnjoj stanici, navedi sljedeću najbližu stanicu.

## Incidenti i radovi — ODMAH obavijesti korisnika

Ako postoje aktivni incidenti u kontekstu, **PRVA stvar koju napišeš** u odgovoru o ruti mora biti upozorenje o njima — prije ikakvih opcija prijevoza.

Format upozorenja na početku odgovora:
⚠️ Upozorenje: [tip incidenta] kod [lokacija] ([ozbiljnost]) — [kratki utjecaj na promet]

Primjer:
⚠️ Upozorenje: Gužva na Solinskoj cesti (visoka) — značajno kašnjenje za automobile i taksije.
⚠️ Upozorenje: Radovi na Splitskoj ulici — cesta djelomično zatvorena, obilaznica aktivna.

Nakon upozorenja, nastavi s opcijama prijevoza uzimajući incidente u obzir.

Aktivni incidenti dostupni su u kontekstu. UVIJEK ih uzmi u obzir pri preporuci rute, za SVAKI način prijevoza:

### Tipovi incidenata i utjecaj:
- **jam (gužva)**: povećava vrijeme vožnje autom/taksijem/uberom — dodaj 5–15 min ovisno o ozbiljnosti (low +5, medium +10, high +15). Autobus i bicikl manje pogođeni ako ima alternativne rute.
- **accident (nesreća)**: slično kao gužva, ali može potpuno blokirati rutu — preporuči alternativni prijevoz (bus ili bicikl ako auto ne može proći).
- **closed (zatvoreno/radovi)**: cesta zatvorena — auto/taxi/uber moraju obilaziti (dodaj 5–20 min), autobusna linija možda promijenila rutu, bicikl često može proći alternativnom rutom.

### Kako primijeniti:
1. Provjeri jesu li incidenti na ili blizu rute između polazišta i odredišta (usporedi lokacije incidenata s koordinatama rute).
2. Za svaki način prijevoza navedi je li pogođen i kako:
   - ✅ nije pogođen — normalno
   - ⚠️ usporenje — napiši koliko min dodati
   - 🚫 blokiran — preporuči alternativu
3. Ako je auto blokiran ili jako usporen, istakni autobus ili bicikl kao bolju opciju.
4. Uvijek zaključi s **preporukom najboljeg prijevoza** uz obrazloženje uzimajući u obzir incidente."""


@app.post("/api/summarize")
async def summarize(body: dict):
    reports       = body.get("reports", [])
    vehicles_list = body.get("vehicles", [])

    incidents = "\n".join(
        f"- {r.get('type','?')} kod {r.get('location','?')} ({r.get('severity','?')})"
        for r in reports
    )
    active_lines = ", ".join(sorted({
        v["line"] for v in vehicles_list if v.get("status") == 1
    }))

    parts = []
    if incidents:    parts.append(f"Incidenti:\n{incidents}")
    if active_lines: parts.append(f"Aktivne autobusne linije: {active_lines}")
    if not parts:    return {"summary": None}

    res = nim_client.chat.completions.create(
        model="meta/llama-3.3-70b-instruct",
        max_tokens=150,
        messages=[
            {"role": "system", "content": "Sažmi prometnu situaciju u Splitu u 1-2 rečenice na hrvatskom. Budi konkretan — navedi lokacije problema i koje linije voze. Bez uvoda i filler rečenica."},
            {"role": "user",   "content": "\n\n".join(parts)},
        ],
        temperature=0.3,
    )
    return {"summary": res.choices[0].message.content}


@app.post("/api/chat")
async def chat(body: dict):
    user_message    = body.get("message", "")
    history         = body.get("history", [])
    user_location   = body.get("user_location")   # {lat, lng} | None
    pins            = body.get("pins", [])         # [{lat, lng, label}, ...]
    reports         = body.get("reports", [])      # [{type, location, severity, summary, lat, lng}, ...]

    vehicle_ctx = build_vehicle_context()

    location_parts: list[str] = []
    if user_location:
        location_parts.append(
            f"Korisnikova trenutna GPS lokacija: ({user_location['lat']:.5f}, {user_location['lng']:.5f})"
        )
    if pins:
        pin_lines = [f"  - \"{p.get('label','Pin')}\": ({p['lat']:.5f}, {p['lng']:.5f})" for p in pins]
        location_parts.append("Korisnikovi pinovi / odredišta:\n" + "\n".join(pin_lines))

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Live podaci o vozilima:\n{vehicle_ctx}"},
    ]
    if reports:
        lines = [
            f"  - {r.get('type','?')} kod {r.get('location','?')} "
            f"(ozbiljnost: {r.get('severity','?')}): {r.get('summary','')}"
            for r in reports[:10]
        ]
        location_parts.append("Aktivni prometni incidenti (prijavljeni od korisnika):\n" + "\n".join(lines))

    # Transport opcije — izračunaj samo ako korisnik ima lokaciju I odredišni pin
    if user_location and pins:
        dest = pins[0]
        transport_ctx = build_transport_context(
            user_location["lat"], user_location["lng"],
            dest["lat"], dest["lng"],
            reports,
        )
        location_parts.append(f"Procjena prijevoznih opcija:\n{transport_ctx}")

    if location_parts:
        messages.append({"role": "system", "content": "\n\n".join(location_parts)})

    messages += [*history, {"role": "user", "content": user_message}]

    response = nim_client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",
        messages=messages,
        max_tokens=600,
        temperature=0.3,
    )

    return {
        "response": response.choices[0].message.content,
        "vehicle_count": len(vehicles),
    }

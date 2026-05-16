# SPLIT // PROMETNI AGENT — Technical Summary
## What It Is
A real-time urban mobility intelligence platform for Split, Croatia. It aggregates live bus positions, user-reported traffic incidents, bike-sharing availability, and OSM road construction data into a single map view, with an LLM-powered chat agent that answers routing questions using all of that live context.

## Architecture

```
Browser (Vercel CDN)
  │
  ├─ WebSocket ──────────────────────────► Railway (FastAPI)
  │                                            │
  ├─ REST /api/* ────────────────────────►     ├─ SignalR poller → promet-split.hr
  │                                            ├─ Nextbike API (3 min refresh)
  ├─ Supabase SDK (direct) ─────────────►      ├─ NVIDIA NIM API (LLaMA)
  │    PostgreSQL (incident reports)           └─ Overpass proxy
  │
  └─ Overpass mirrors (construction/validation)
```
### Tech Stack
Layer	Technology
Frontend:	React 18, Vite, react-leaflet, react-leaflet-cluster
Backend:	FastAPI (Python), uvicorn, httpx, websockets
Database	Supabase (PostgreSQL + realtime subscriptions)
AI	NVIDIA NIM — meta/llama-3.3-70b-instruct (summarize), meta/llama-3.1-70b-instruct (chat)
Deploy	Vercel (frontend static), Railway (backend persistent)
Map tiles	OpenStreetMap
Data Sources
1. Promet Split bus fleet — Connects to the official promet-split.hr SignalR hub via a persistent WebSocket in the backend. Receives real-time vehicle position updates for every active bus. Calculates heading and compass direction from consecutive GPS positions using bearing math. Broadcasts updates to all frontend clients via a second WebSocket managed by FastAPI's ConnectionManager.

2. Nextbike bike-sharing — Polls the Nextbike live API every 3 minutes for all stations in Split, Solin, Trogir, and Kaštela (city codes 617, 740, 802, 804). Returns available bikes, e-bikes, and free rack count per station.

3. OpenStreetMap Overpass — Queries railway=construction, access=no, and road barrier tags for the Split bounding box. Proxied through the Railway backend (with 4 mirror fallbacks) to avoid browser connectivity restrictions. Refreshes every 10 minutes.

4. Supabase — Stores user-submitted incident reports (jam, accident, closed) with lat/lng, severity, location string, vote count, and timestamp. Realtime subscription pushes new reports to all connected clients without polling.

AI Integration
Traffic summary (/api/summarize)
Takes the list of all active incidents + active bus line IDs, constructs a bullet list, and prompts LLaMA to generate 1–2 sentences describing the current situation. System prompt switches between Croatian and English based on the lang parameter sent from the frontend.

Chat agent (/api/chat)
Each request includes a rich system context injected dynamically:

Full live vehicle snapshot: all buses with position, direction, compass heading, and status
Bus schedule data parsed from the PDF timetable (refreshed every 6 hours)
Nextbike station data with nearest stations to user/destination
Active incident reports
User's GPS location (if granted) and navigation pins
Transport cost/ETA calculation (bus, bike, Uber, taxi) using Haversine distance between user location and destination pin
Incident delay estimation: checks each incident's proximity to the user's route and adds minutes to ETA for auto/taxi
The system prompt includes 40+ named coordinates for Split neighbourhoods, POIs, beaches, and all bus line routes, so the AI can translate raw GPS coordinates into place names for the user.

Language is enforced via a separate system message ("Respond exclusively in English." / "Odgovaraj isključivo na hrvatskom jeziku.") injected before the vehicle context.

## Key Features
**Location validation** — Before opening the incident report modal, two parallel Overpass queries run: is_in(lat, lng) to check if the clicked point is inside a water/forest/farmland area, and way(around:200)["highway"] to confirm a road is within 200 m. Fails open (allows report) if Overpass is unreachable.

**Vote deduplication** — Each browser stores a Set of voted report IDs in localStorage. upvoteReport checks the set before calling Supabase, so the same device can only confirm each incident once regardless of page refreshes.

**Real-time bus heading** — The backend tracks the previous position of each vehicle. When a new position arrives and the vehicle has moved more than ~11 m, it recalculates bearing using the haversine formula and stores the compass direction. This drives the animated arrow ring on each bus marker.

**PDF schedule parsing** — On startup (and every 6 hours), the backend downloads the HŽ / Promet Split timetable PDF, extracts departure times using pdfplumber with a regex for HH:MM patterns grouped by line identifier, and makes them available to the AI chat context.

**Multilingual UI** — A React context (LangContext) holds all UI strings for Croatian and English. Switching language resets the chat history and re-fetches the AI summary in the new language. The language is sent with every API request so the backend LLM responds in the correct language.

**Mobile layout** — Below 768 px, the map and chat panels switch to a fullscreen tab layout with a bottom navigation bar. Above 768 px, both panels are visible side by side.

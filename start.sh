#!/usr/bin/env bash
set -e

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="/home/roko/Code/PrometAPI/.venv"
PORT_BACKEND=8000
PORT_FRONTEND=5173

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[0;33m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}${CYAN}┌─────────────────────────────────────────┐${NC}"
echo -e "${BOLD}${CYAN}│   SPLIT PROMETNI AGENT — dev launcher   │${NC}"
echo -e "${BOLD}${CYAN}└─────────────────────────────────────────┘${NC}"
echo ""

# ── Kill any leftover processes ───────────────────────────────────────────────
echo -e "${YELLOW}▸ Čistim stare procese...${NC}"
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite"             2>/dev/null || true
sleep 1

# ── Backend ───────────────────────────────────────────────────────────────────
echo -e "${GREEN}▸ Pokrećem backend (port ${PORT_BACKEND})...${NC}"
cd "$BACKEND_DIR"
"$VENV/bin/uvicorn" main:app \
  --port "$PORT_BACKEND" \
  --reload \
  2>&1 | sed "s/^/${RED}[backend]${NC} /" &
BACKEND_PID=$!
cd "$FRONTEND_DIR"

# Čekaj da backend postane dostupan
echo -ne "${YELLOW}  Čekam backend..."
for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf "http://localhost:${PORT_BACKEND}/api/vehicles" -o /dev/null 2>/dev/null; then
    echo -e " ${GREEN}OK${NC}"
    break
  fi
  echo -n "."
done
echo ""

# ── Frontend ──────────────────────────────────────────────────────────────────
echo -e "${GREEN}▸ Pokrećem frontend (port ${PORT_FRONTEND})...${NC}"
cd "$FRONTEND_DIR"
npx vite --port "$PORT_FRONTEND" \
  2>&1 | sed "s/^/${CYAN}[frontend]${NC} /" &
FRONTEND_PID=$!

sleep 2
echo ""
echo -e "${BOLD}${GREEN}✓ App je živa!${NC}"
echo -e "  Frontend : ${BOLD}http://localhost:${PORT_FRONTEND}${NC}"
echo -e "  Backend  : ${BOLD}http://localhost:${PORT_BACKEND}${NC}"
echo -e "  WebSocket: ${BOLD}ws://localhost:${PORT_BACKEND}/ws/vehicles${NC}"
echo ""
echo -e "${YELLOW}  Ctrl+C za zaustavljanje oba servera${NC}"
echo ""

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}▸ Gasim servere...${NC}"
  kill "$BACKEND_PID"  2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null
  echo -e "${GREEN}▸ Zaustavljeno.${NC}"
  exit 0
}
trap cleanup INT TERM

wait

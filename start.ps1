# Split Prometni Agent — Windows launcher
# Pokretanje: .\start.ps1
# Zahtijeva: Python 3.11+, Node.js 18+

$ErrorActionPreference = 'SilentlyContinue'
$BackendDir  = Join-Path $PSScriptRoot "backend"
$FrontendDir = $PSScriptRoot

function Write-Header {
  Write-Host ""
  Write-Host "  +-----------------------------------------+" -ForegroundColor Cyan
  Write-Host "  |   SPLIT PROMETNI AGENT - dev launcher   |" -ForegroundColor Cyan
  Write-Host "  +-----------------------------------------+" -ForegroundColor Cyan
  Write-Host ""
}

function Find-Uvicorn {
  # Traži uvicorn: lokalni venv → PrometAPI venv → global
  $candidates = @(
    (Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"),
    (Join-Path $PSScriptRoot ".venv\Scripts\uvicorn.exe"),
    (Join-Path $PSScriptRoot "..\PrometAPI\.venv\Scripts\uvicorn.exe"),
    "uvicorn"
  )
  foreach ($c in $candidates) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { return $c }
    if (Test-Path $c) { return $c }
  }
  return $null
}

Write-Header

# ── Provjera ovisnosti ────────────────────────────────────────────────────────
$uvicorn = Find-Uvicorn
if (-not $uvicorn) {
  Write-Host "  [!] uvicorn nije pronađen. Instaliraj: pip install -r backend\requirements.txt" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command "npx" -ErrorAction SilentlyContinue)) {
  Write-Host "  [!] Node.js / npx nije pronađen. Instaliraj s https://nodejs.org" -ForegroundColor Red
  exit 1
}

# ── Gasi stare procese ────────────────────────────────────────────────────────
Write-Host "  Cistim stare procese..." -ForegroundColor Yellow
Get-Process -Name "uvicorn" | Stop-Process -Force
# Gasi node procese koji drže port 5173 / 8000
@(5173, 8000) | ForEach-Object {
  $port = $_
  $conn = netstat -ano | Select-String ":$port\s" | Select-Object -First 1
  if ($conn -match '\s(\d+)$') {
    Stop-Process -Id $Matches[1] -Force
  }
}
Start-Sleep -Seconds 1

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host "  Pokrecm backend (port 8000)..." -ForegroundColor Green
$backend = Start-Process -FilePath $uvicorn `
  -ArgumentList "main:app", "--app-dir", "`"$BackendDir`"", "--port", "8000", "--reload" `
  -PassThru -NoNewWindow

# Čekaj da backend postane dostupan
Write-Host -NoNewline "  Cekam backend"
$ready = $false
for ($i = 0; $i -lt 24; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    Invoke-WebRequest "http://localhost:8000/api/vehicles" -UseBasicParsing -TimeoutSec 1 | Out-Null
    $ready = $true; break
  } catch {}
  Write-Host -NoNewline "."
}
if ($ready) { Write-Host "  OK" -ForegroundColor Green }
else        { Write-Host "  timeout (nastavlja se...)" -ForegroundColor Yellow }

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host "  Pokrecm frontend (port 5173)..." -ForegroundColor Green
Push-Location $FrontendDir
$frontend = Start-Process -FilePath "npx" `
  -ArgumentList "vite", "--port", "5173" `
  -PassThru -NoNewWindow
Pop-Location

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "  App je ziva!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  WebSocket: ws://localhost:8000/ws/vehicles" -ForegroundColor White
Write-Host ""
Write-Host "  Ctrl+C za zaustavljanje oba servera" -ForegroundColor Yellow
Write-Host ""

# ── Graceful shutdown ─────────────────────────────────────────────────────────
try {
  Wait-Process -Id $backend.Id, $frontend.Id
}
finally {
  Write-Host "`n  Gasim servere..." -ForegroundColor Yellow
  Stop-Process -Id $backend.Id  -Force
  Stop-Process -Id $frontend.Id -Force
  Write-Host "  Zaustavljeno." -ForegroundColor Green
}

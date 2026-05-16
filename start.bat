@echo off
title Split Prometni Agent
echo.
echo  +-----------------------------------------+
echo  ^|   SPLIT PROMETNI AGENT - dev launcher   ^|
echo  +-----------------------------------------+
echo.

REM ── Backend ──────────────────────────────────────────────────────────────────
echo  [1/2] Pokrecem backend na portu 8000...
start "PrometAPI Backend" cmd /k "cd /d "%~dp0backend" && uvicorn main:app --port 8000 --reload"

REM Kratko cekanje da se backend podigne
timeout /t 4 /nobreak >nul

REM ── Frontend ─────────────────────────────────────────────────────────────────
echo  [2/2] Pokrecem frontend na portu 5173...
start "PrometAPI Frontend" cmd /k "cd /d "%~dp0" && npx vite --port 5173"

timeout /t 2 /nobreak >nul

echo.
echo  App je ziva!
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:8000
echo.
echo  Zatvori otvorene prozore da zaustavi servere.
echo.
pause

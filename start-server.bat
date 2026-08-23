@echo off
rem LifeFlow v3 preview server
cd /d "%~dp0"
echo Starting LifeFlow v3 preview: http://localhost:8103/
start "" "http://localhost:8103/index.html"
python -m http.server 8103

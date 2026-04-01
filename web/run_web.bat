@echo off
echo ============================================================
echo  PLC Professional — Versión Web
echo ============================================================
echo.
cd /d "%~dp0"
echo Instalando dependencias...
..\venv310\Scripts\pip install -r requirements_web.txt -q
echo.
echo Iniciando servidor en http://localhost:8000
echo Presiona Ctrl+C para detener.
echo.
..\venv310\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause

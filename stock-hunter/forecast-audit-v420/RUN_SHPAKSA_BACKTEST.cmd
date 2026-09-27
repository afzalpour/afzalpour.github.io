@echo off
chcp 65001 >nul
cd /d "%~dp0"
Stock_Hunter_Forecast_Audit_v4.2.0.exe
echo.
echo Report finished. Copy the output above or send the generated forecast_audit_*.json file.
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
Stock_Hunter_Forecast_Audit_v4.2.1.exe
echo.
echo Audit finished. Send the generated forecast_audit_*.json file.
pause

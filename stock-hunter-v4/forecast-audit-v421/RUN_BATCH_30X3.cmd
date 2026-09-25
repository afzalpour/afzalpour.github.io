@echo off
chcp 65001 >nul
cd /d "%~dp0"
Stock_Hunter_Forecast_Audit_v4.2.1.exe --batch BATCH_SAMPLE_30X3.csv
echo.
echo Batch finished. Send forecast_batch_audit_v421.json for review.
pause

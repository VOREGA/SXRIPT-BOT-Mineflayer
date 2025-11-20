@echo off
title Mineflayer Bot Yoneticisi
cls
:loop
echo.
echo =====================================================
echo [SISTEM] Bot baslatiliyor... (RAM Limiti: 4GB)
echo =====================================================
echo.

:: RAM AYARI: 4096 yazan yeri 8192 yaparsan 8GB ram verirsin.
node --max-old-space-size=4096 index.js

echo.
echo =====================================================
echo [UYARI] Bot kapandi veya coktu!
echo 5 saniye icinde otomatik olarak yeniden baslatiliyor...
echo Durdurmak icin bu pencereyi kapatin.
echo =====================================================
timeout /t 5 >nul
goto loop
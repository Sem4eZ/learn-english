@echo off
chcp 65001 > nul
title Fluentiq - English Mastery Platform

echo.
echo =========================================================
echo    🚀 Запуск Fluentiq (React + TypeScript + Node.js)
echo =========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js не найден в системе. Установите Node.js 18+ для запуска.
    pause
    exit /b 1
)

echo [1/2] Запуск сервера и интерфейса...
node run.js

pause

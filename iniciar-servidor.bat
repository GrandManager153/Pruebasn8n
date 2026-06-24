@echo off
title Lanzador SleekAPI - Servidor + ML API
color 0B
cd /d "%~dp0"

echo =====================================================================
echo    SleekAPI - Servidor local + API de Machine Learning
echo =====================================================================
echo.

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%ProgramFiles%\nodejs\npm.cmd" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else (
        echo [ERROR] Node.js / npm no esta en el PATH.
        echo Instala Node.js LTS desde https://nodejs.org y reinicia la terminal.
        pause
        exit /b 1
    )
)

echo [*] [1/3] Instalando dependencias...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No se pudo ejecutar npm install.
    pause
    exit /b 1
)
echo [+] Dependencias listas.
echo.

echo [*] [2/3] Iniciando servidor Node en http://localhost:3000
start "SleekAPI - Servidor Local" /d "%~dp0" cmd /k node server.js
echo.

echo [*] [3/3] Iniciando ML API Python en http://127.0.0.1:8000
start "SleekAPI - ML API Python" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ml-api.ps1"
echo.

echo =====================================================================
echo    Listo
echo    Dashboard:  http://localhost:3000
echo    ML API:     http://127.0.0.1:8000
echo =====================================================================
echo.
pause

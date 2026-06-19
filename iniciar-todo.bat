@echo off
title Lanzador de API Local y ngrok - SleekAPI
color 0B
cd /d "%~dp0"

echo =====================================================================
echo    ⚡  BIENVENIDO AL LANZADOR DE SLEEKAPI + NGROK  ⚡
echo =====================================================================
echo.
echo [*] [1/4] Verificando e instalando dependencias (npm install)...
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "%ProgramFiles%\nodejs\npm.cmd" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else (
        echo.
        echo [ERROR] Node.js / npm no esta en el PATH.
        echo Instala Node.js LTS desde https://nodejs.org y reinicia la terminal.
        pause
        exit /b 1
    )
)
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] No se pudo ejecutar 'npm install'.
    echo Por favor, asegúrate de que Node.js está instalado y reinicia la terminal.
    pause
    exit /b
)
echo [+] Dependencias listas.
echo.

echo [*] [2/4] Iniciando el servidor API en una nueva ventana...
start "SleekAPI - Servidor Local" cmd /k "cd /d \"%~dp0\" && node server.js"
echo [+] Servidor API iniciado en http://localhost:3000
echo.

echo [*] [3/4] Iniciando la API de Machine Learning (Python)...
start "SleekAPI - ML API Python" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ml-api.ps1"
echo [+] Servidor ML API iniciado en http://127.0.0.1:8000
echo.

echo [*] [4/4] Iniciando túnel seguro de ngrok con dominio estático en el puerto 3000...
echo.
echo [!] NOTA: Si es tu primera vez usando ngrok, asegúrate de haber guardado
echo     tu token ejecutando primero: ngrok config add-authtoken TU_TOKEN
echo.
timeout /t 3 /nobreak > nul
start "ngrok - Túnel Público" cmd /k "ngrok http 3000 --domain=delegate-operation-browbeat.ngrok-free.dev --host-header=rewrite"
echo [+] Túnel de ngrok iniciado con el dominio: https://delegate-operation-browbeat.ngrok-free.dev
echo.

echo =====================================================================
echo    🎉  ¡TODO LISTO!  🎉
echo    Tu API local está activa y expuesta a internet de forma segura.
echo =====================================================================
echo.
pause

@echo off
echo ===================================
echo  Nova AI - Reinicio limpio
echo ===================================
echo.
echo Matando servidores Node.js existentes...
taskkill /F /IM node.exe /T 2>nul
echo.
echo Esperando 2 segundos...
timeout /t 2 /nobreak >nul
echo.
echo Arrancando Nova AI...
echo.
cd /d "%~dp0"
npm run dev

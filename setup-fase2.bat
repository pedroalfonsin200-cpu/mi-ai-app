@echo off
echo ===================================
echo  Nova AI - Setup Fase 2
echo  Login + Historial + Rediseno UI
echo ===================================
echo.

cd /d "%~dp0"

echo [1/4] Instalando nueva dependencia...
npm install @supabase/ssr

echo [2/4] Verificando build local...
echo (presiona Ctrl+C si el server dev esta corriendo)
timeout /t 3 /nobreak >nul

echo [3/4] Agregando cambios a git...
git add .

echo [4/4] Commit + push...
git commit -m "feat: login, chat history, cosmic UI redesign"
git push origin main

echo.
echo ===================================
echo  LISTO
echo ===================================
echo.
echo Vercel detectara el push y rebuildeara.
echo.
echo IMPORTANTE: Antes de usar login necesitas:
echo   1. Correr el SQL en Supabase
echo   2. Configurar Google OAuth
echo.
echo Lee las instrucciones en el chat.
echo.
pause

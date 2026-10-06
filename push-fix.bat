@echo off
echo ===================================
echo  Nova AI - Push fix a GitHub
echo ===================================
echo.

cd /d "%~dp0"

echo [1/3] Agregando cambios...
git add .

echo [2/3] Creando commit...
git commit -m "fix: add clsx and tailwind-merge to deps"

echo [3/3] Subiendo a GitHub...
git push origin main

echo.
echo ===================================
echo  PUSH COMPLETO
echo ===================================
echo.
echo Vercel va a detectar el cambio
echo y lanzar un deploy nuevo automatico.
echo.
pause

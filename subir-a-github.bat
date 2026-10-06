@echo off
echo ===================================
echo  Nova AI - Subir a GitHub
echo ===================================
echo.

cd /d "%~dp0"

echo [1/5] Configurando Git...
git config user.email "pedroalfonsin200@gmail.com"
git config user.name "pedroalfonsin200-cpu"

echo [2/5] Inicializando repositorio...
if not exist ".git" (
    git init
    git branch -M main
)

echo [3/5] Conectando con GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/pedroalfonsin200-cpu/mi-ai-app.git

echo [4/5] Agregando archivos (.env.local esta protegido)...
git add .
git commit -m "Nova AI - initial deploy"

echo [5/5] Subiendo a GitHub...
echo.
echo IMPORTANTE: Se abrira una ventana del navegador
echo para que inicies sesion en GitHub.
echo Autoriza y vuelve aqui.
echo.
pause
git push -u origin main --force

echo.
echo ===================================
echo  LISTO
echo ===================================
echo.
echo Ve a: https://github.com/pedroalfonsin200-cpu/mi-ai-app
echo para ver tu codigo subido.
echo.
pause

@echo off
REM ====================================================================
REM  Sobe tudo: banco (Docker), API e site.
REM  Requisitos: Docker Desktop rodando e Node.js instalado.
REM ====================================================================

echo [1/3] Subindo PostgreSQL + pgAdmin...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Nao consegui subir o Docker. O Docker Desktop esta aberto?
  pause
  exit /b 1
)

echo Aguardando o banco ficar pronto...
timeout /t 8 /nobreak >nul

echo [2/3] Subindo a API (porta 3333)...
start "API - Optica Popular" cmd /k "cd backend && npm run dev"

echo [3/3] Subindo o site (porta 5173)...
start "Site - Optica Popular" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================================================
echo   Site .......... http://localhost:5173
echo   Painel admin .. http://localhost:5173/admin
echo   API ........... http://localhost:3333/api/health
echo   pgAdmin ....... http://localhost:5050
echo ====================================================================
echo.
pause

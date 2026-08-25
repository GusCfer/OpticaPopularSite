echo [1/2] Subindo a API (porta 3333)...
start "API - Optica Popular" cmd /k "cd backend && npm run dev"

echo [2/2] Subindo o site (porta 5173)...
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

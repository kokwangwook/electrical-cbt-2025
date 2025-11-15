@echo off
echo ========================================
echo ngrok 외부 접근 설정
echo ========================================
echo.

echo [1/2] 개발 서버 시작 중...
start cmd /k "npm run dev"

echo.
echo [2/2] 3초 후 ngrok을 시작합니다...
timeout /t 3 /nobreak > nul

echo.
echo ngrok 터널링 시작...
ngrok http 5173

pause



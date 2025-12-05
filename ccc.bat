@echo off
chcp 65001 >nul
cls

echo ========================================================
echo [INFO] Electrical CBT 로컬 서버 실행기
echo ========================================================

:: 1. 프로젝트 폴더로 이동
set "PROJECT_DIR=d:\cbt\electrical-cbt"

if not exist "%PROJECT_DIR%" (
    echo [ERROR] 프로젝트 폴더를 찾을 수 없습니다: %PROJECT_DIR%
    pause
    exit /b
)

cd /d "%PROJECT_DIR%"
echo [STEP 1] 프로젝트 폴더 이동 완료

:: 2. 서버 실행 (새 창에서 실행)
echo [STEP 2] 서버를 새 창에서 시작합니다...
start "Electrical CBT Server" cmd /k "npm run dev"

:: 3. 대기 (서버가 켜질 때까지 5초 대기)
echo [STEP 3] 서버 구동을 기다리는 중 (5초)...
timeout /t 5 >nul

:: 4. 크롬 실행
echo [STEP 4] 크롬 브라우저를 실행합니다...
start chrome "http://localhost:5173"

echo.
echo [SUCCESS] 실행이 완료되었습니다.
echo 이 창은 닫아도 서버(새 창)는 계속 실행됩니다.
pause

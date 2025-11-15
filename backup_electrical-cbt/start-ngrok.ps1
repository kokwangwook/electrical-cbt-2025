# ngrok 외부 접근 설정 스크립트

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ngrok 외부 접근 설정" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1단계: 개발 서버 시작
Write-Host "[1/2] 개발 서버 시작 중..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

# 2단계: 잠시 대기
Write-Host ""
Write-Host "[2/2] 3초 후 ngrok을 시작합니다..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 3단계: ngrok 시작
Write-Host ""
Write-Host "ngrok 터널링 시작..." -ForegroundColor Green
Write-Host "외부 URL은 아래에 표시됩니다:" -ForegroundColor Green
Write-Host ""

ngrok http 5173



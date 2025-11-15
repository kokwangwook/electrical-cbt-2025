# Backup - 2025-11-14

## 백업 정보
- **백업 일시**: 2025년 11월 14일
- **백업 목적**: 실전 모의고사 새창 띄우기 및 홈 화면 재설계 작업 전 현재 상태 보존
- **백업 내용**: src/pages/ 디렉토리의 주요 컴포넌트 파일

## 백업된 파일 목록
1. `Home.tsx.backup` - 홈 화면 (문제 현황, 시험 모드 선택)
2. `Exam.tsx.backup` - 시험 화면 (문제 풀이, 타이머, 채점)
3. `Login.tsx.backup` - 로그인 화면
4. `Admin.tsx.backup` - 관리자 화면

## 현재 상태 요약
### ✅ 구현된 기능
- localStorage 기반 문제 현황 실시간 동기화
- 페이지 포커스 시 자동 업데이트
- 수동 새로고침 버튼
- 카테고리별 문제 그룹화 (전기이론 1-20, 전기기기 21-40, 전기설비 41-60)
- 60분 타이머
- 채점 기능
- 오답노트 시스템
- 인쇄 기능 (2단 레이아웃, 페이지 구분 최적화)

### 🎯 작업 예정 사항
1. **Home.tsx 재설계**:
   - B-1: 실전 모의고사 (60분 제한) - 파란색 강조
   - B-2: 랜덤 60문제 (시간 제한 없음) - 초록색
   - C-1: 카테고리별 집중 학습 (20문제) - 유지
   - C-2: 스마트 오답노트 복습 (최대 20문제) - 유지

2. **새창 기능 구현**:
   - 실전 모의고사(B-1) 모드는 새창으로 시험 진행
   - 데이터 전달 및 세션 관리

3. **Exam.tsx 개선**:
   - 4개 섹션 레이아웃 (Header, Toolbar, Main Area, Footer)
   - 조건부 타이머 (B-1 모드만)
   - 레이아웃 제어 기능

## 복원 방법
만약 작업 중 문제가 발생하여 이전 상태로 되돌려야 할 경우:

```bash
# Windows (PowerShell)
Copy-Item "d:\cbt\electrical-cbt\.backup\2025-11-14\Home.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Home.tsx" -Force
Copy-Item "d:\cbt\electrical-cbt\.backup\2025-11-14\Exam.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Exam.tsx" -Force
Copy-Item "d:\cbt\electrical-cbt\.backup\2025-11-14\Login.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Login.tsx" -Force
Copy-Item "d:\cbt\electrical-cbt\.backup\2025-11-14\Admin.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Admin.tsx" -Force
```

```bash
# Linux/Mac (Bash)
cp "d:\cbt\electrical-cbt\.backup\2025-11-14\Home.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Home.tsx"
cp "d:\cbt\electrical-cbt\.backup\2025-11-14\Exam.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Exam.tsx"
cp "d:\cbt\electrical-cbt\.backup\2025-11-14\Login.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Login.tsx"
cp "d:\cbt\electrical-cbt\.backup\2025-11-14\Admin.tsx.backup" "d:\cbt\electrical-cbt\src\pages\Admin.tsx"
```

## 주의사항
- 복원 시 현재 작업 중인 파일이 덮어씌워집니다.
- 복원 전에 현재 상태를 다시 백업하는 것을 권장합니다.
- 백업 파일은 삭제하지 마세요.

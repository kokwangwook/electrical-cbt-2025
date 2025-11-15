# Version 1.0.0 - 2025-01-15

## 변경 사항

### 1. 모바일/태블릿 이미지 표시 문제 수정
- **파일**: `src/pages/Exam.tsx` (1475-1490줄)
- **파일**: `src/components/Question.tsx` (62-76줄)
- **문제**: PC 버전은 `hasImage` 체크 후 placeholder 표시, 모바일은 `imageUrl`만 체크
- **수정**: 모바일/태블릿에서도 `hasImage` 체크 후 "이미지 준비 중" placeholder 표시

### 2. 모바일 레이아웃 최적화
- **파일**: `src/pages/Exam.tsx`
- **문제**: 모바일에서 불필요한 여백과 큰 답안 표기란
- **수정**:
  - 문제 영역 최소 높이: `600px` → `300px`
  - 답안 표기란 패딩/마진 축소
  - 카테고리 레이블 컴팩트화

### 3. 문제 현황 표시 버그 수정
- **파일**: `src/pages/Home.tsx` (503-532줄)
- **문제**: `||` 연산자가 0을 falsy로 처리하여 기본값 표시
- **수정**: `||`를 `??` (nullish coalescing)으로 변경

### 4. 자동 TSV 데이터 로딩 기능 추가
- **파일**: `src/pages/Home.tsx` (72-196줄, 549-569줄)
- **기능**:
  - 처음 로그인 시 문제 데이터 0개 감지 → 자동 다운로드
  - 문제 100개 미만 시 사용자 확인 후 다운로드
  - JSON 파일 우선 로드 (TSV 폴백)
  - 로딩 오버레이로 진행 상황 표시
  - "약 30초 소요" 안내 메시지
  - localStorage에 자동 저장
  - 부분 데이터 감지 및 업데이트 기능 (20개 → 5012개)

## 수정된 파일 목록

1. `src/pages/Exam.tsx`
   - 이미지 표시 로직 개선
   - 모바일 레이아웃 최적화

2. `src/pages/Home.tsx`
   - 자동 TSV 데이터 로딩
   - 문제 현황 표시 버그 수정
   - 로딩 오버레이 UI 추가

3. `src/components/Question.tsx`
   - 이미지 표시 로직 통일

## 주요 개선점

- **크로스 플랫폼 일관성**: PC, 태블릿, 모바일에서 동일한 이미지 표시
- **사용자 경험**: 처음 접속 시 자동 데이터 로드
- **버그 수정**: 0개 문제 표시 시 기본값 대신 실제 값 표시
- **성능**: 모바일에서 불필요한 여백 제거로 화면 효율성 향상

## 백업 구조

```
backup/
└── v1.0.0_2025-01-15/
    ├── CHANGELOG.md (이 파일)
    └── src/
        ├── pages/
        │   ├── Exam.tsx
        │   └── Home.tsx
        └── components/
            └── Question.tsx
```

## 테스트 항목

- [ ] PC에서 이미지 표시 확인
- [ ] 모바일에서 이미지 표시 확인 (hasImage=true, imageUrl=null)
- [ ] 태블릿에서 이미지 표시 확인
- [ ] 새 기기에서 자동 TSV 로딩 확인
- [ ] 문제 현황 0개 표시 확인
- [ ] 모바일 레이아웃 여백 확인

## 롤백 방법

문제 발생 시 백업 파일로 복원:
```bash
copy backup\v1.0.0_2025-01-15\src\pages\Exam.tsx src\pages\Exam.tsx
copy backup\v1.0.0_2025-01-15\src\pages\Home.tsx src\pages\Home.tsx
copy backup\v1.0.0_2025-01-15\src\components\Question.tsx src\components\Question.tsx
```

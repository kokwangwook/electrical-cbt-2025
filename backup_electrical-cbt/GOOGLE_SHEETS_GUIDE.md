# 📊 Google Sheets 연동 가이드

## 1. Google Sheets 스프레드시트 만들기

### 1단계: 새 스프레드시트 생성

1. https://sheets.google.com 접속
2. 새로운 스프레드시트 생성
3. 이름을 "전기기능사_문제은행"으로 변경

### 2단계: 데이터 구조 설정

첫 번째 행(헤더)에 다음 열을 생성하세요:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | category | question | option1 | option2 | option3 | option4 | answer | explanation | imageUrl |

**열 설명:**
- **id**: 문제 번호 (1, 2, 3, ...)
- **category**: 분야 (전기이론, 전기기기, 전기설비)
- **question**: 문제 내용
- **option1**: 선택지 1
- **option2**: 선택지 2
- **option3**: 선택지 3
- **option4**: 선택지 4
- **answer**: 정답 번호 (1, 2, 3, 또는 4)
- **explanation**: 해설 (선택사항)
- **imageUrl**: 이미지 URL (선택사항)

### 3단계: 샘플 데이터 입력

```
1 | 전기이론 | 옴의 법칙에서 전압(V), 전류(I), 저항(R)의 관계식으로 옳은 것은? | V = I × R | V = I / R | V = R / I | V = I + R | 1 | 옴의 법칙: 전압 = 전류 × 저항 (V = I × R) |
2 | 전기이론 | 저항 10Ω에 2A의 전류가 흐를 때 소비되는 전력은? | 20W | 40W | 5W | 12W | 2 | P = I²R = 2² × 10 = 40W |
```

## 2. 스프레드시트 공개 설정

### 방법 1: 공개 액세스 (추천)

1. 우측 상단 **공유** 버튼 클릭
2. **링크가 있는 모든 사용자** 선택
3. 역할: **뷰어** 선택
4. **완료** 클릭

### 방법 2: 특정 사용자만 접근

1. Google Cloud Console에서 서비스 계정 생성
2. 서비스 계정 이메일로 스프레드시트 공유
3. 서비스 계정 JSON 키 사용

## 3. 스프레드시트 ID 확인

스프레드시트 URL에서 ID 복사:
```
https://docs.google.com/spreadsheets/d/[여기가_ID]/edit
```

예시:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
```
→ ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

## 4. Google Cloud Console 설정

### 4단계: 프로젝트 생성

1. https://console.cloud.google.com 접속
2. 상단 **프로젝트 선택** → **새 프로젝트**
3. 프로젝트 이름: "전기기능사CBT"
4. **만들기** 클릭

### 5단계: Google Sheets API 활성화

1. 좌측 메뉴 **API 및 서비스** → **라이브러리**
2. "Google Sheets API" 검색
3. **Google Sheets API** 클릭
4. **사용** 클릭

### 6단계: API 키 생성

1. 좌측 메뉴 **API 및 서비스** → **사용자 인증 정보**
2. **사용자 인증 정보 만들기** → **API 키**
3. API 키가 생성됨 (복사해두기)
4. (선택) **키 제한** 클릭하여 보안 설정:
   - **애플리케이션 제한사항**: HTTP 리퍼러
   - **API 제한사항**: Google Sheets API만 선택

## 5. 코드에 설정 적용

`src/services/googleSheets.ts` 파일 열기:

```typescript
// 수정 전
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const API_KEY = 'YOUR_API_KEY';

// 수정 후
const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
const API_KEY = 'AIzaSyD9a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p';
```

## 6. 이미지 추가하기

### Google Drive 이미지 링크 만들기

1. Google Drive에 이미지 업로드
2. 이미지 우클릭 → **공유**
3. **링크가 있는 모든 사용자** 선택
4. 공유 링크 복사:
   ```
   https://drive.google.com/file/d/[FILE_ID]/view
   ```
5. 다음 형식으로 변환:
   ```
   https://drive.google.com/uc?export=view&id=[FILE_ID]
   ```

### 예시

원본 링크:
```
https://drive.google.com/file/d/1ABC-DEF123xyz/view
```

변환된 링크 (imageUrl에 입력):
```
https://drive.google.com/uc?export=view&id=1ABC-DEF123xyz
```

## 7. 테스트

1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 http://localhost:5173 접속
3. **시험 시작** 버튼 클릭
4. Google Sheets의 문제가 표시되는지 확인

## 🔧 문제 해결

### 문제: "Google Sheets API 오류"

**해결책:**
1. API 키가 정확히 입력되었는지 확인
2. Google Sheets API가 활성화되었는지 확인
3. 스프레드시트가 공개로 설정되었는지 확인

### 문제: "문제 데이터가 없습니다"

**해결책:**
1. 스프레드시트 ID가 정확한지 확인
2. 시트 이름이 "Questions"인지 확인
3. 헤더 행이 첫 번째 줄에 있는지 확인

### 문제: 일부 문제만 로드됨

**해결책:**
1. 모든 필수 열(id ~ answer)이 채워져 있는지 확인
2. answer 열이 1~4 숫자인지 확인
3. 빈 행이 없는지 확인

## 📝 Excel에서 Google Sheets로 가져오기

1. Excel에서 데이터 준비 (위의 구조대로)
2. Google Sheets에서 **파일** → **가져오기**
3. Excel 파일 선택
4. 가져오기 설정:
   - 가져오기 위치: **기존 스프레드시트 바꾸기**
   - 구분 기호: **자동 감지**

## 🎯 팁

- **대량 데이터**: 2000문제 정도까지 문제없이 사용 가능
- **캐싱**: 24시간 동안 브라우저에 캐시되어 빠른 로딩
- **업데이트**: Google Sheets 수정 후 새로고침하면 반영
- **백업**: 정기적으로 Google Sheets 사본 만들기

## 📞 추가 도움이 필요하신가요?

- Google Sheets API 문서: https://developers.google.com/sheets/api
- Google Cloud Console: https://console.cloud.google.com

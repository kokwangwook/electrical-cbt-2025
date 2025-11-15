# 🚀 CBT 호스팅 가이드

동시접속자 20명, 월 트래픽 1000건 규모에 맞춘 호스팅 가이드입니다.

## 📋 요구사항
- 동시접속자: 20명
- 월 트래픽: 약 1,000건
- Supabase 백엔드 사용
- React + Vite 기반 SPA

---

## 🎯 추천 호스팅 옵션

### 1. Vercel (⭐ 추천)
**장점:**
- 무료 플랜으로 충분 (월 100GB 대역폭, 무제한 요청)
- 자동 배포 (GitHub 연동)
- 환경 변수 관리 쉬움
- 글로벌 CDN
- 한국 접속 속도 우수

**무료 플랜 제한:**
- 월 100GB 대역폭
- 무제한 요청
- 동시접속자 제한 없음 (충분)

**배포 방법:**
1. [Vercel](https://vercel.com) 가입
2. GitHub 저장소 연결
3. 프로젝트 import
4. 환경 변수 설정:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Deploy!

---

### 2. Netlify
**장점:**
- 무료 플랜 제공
- 자동 배포
- 환경 변수 관리
- 폼 처리 기능

**무료 플랜 제한:**
- 월 100GB 대역폭
- 월 300분 빌드 시간
- 충분한 용량

**배포 방법:**
1. [Netlify](https://www.netlify.com) 가입
2. GitHub 저장소 연결
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 환경 변수 설정 (Site settings → Environment variables)
5. Deploy!

---

### 3. Cloudflare Pages
**장점:**
- 완전 무료 (대역폭 무제한)
- 매우 빠른 CDN
- 자동 배포

**배포 방법:**
1. [Cloudflare](https://pages.cloudflare.com) 가입
2. GitHub 저장소 연결
3. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
4. 환경 변수 설정
5. Deploy!

---

## 🔧 배포 전 준비사항

### 1. 환경 변수 파일 생성

`.env.production` 파일을 생성하세요:

```env
VITE_SUPABASE_URL=https://eeyzenpolbrfmsamguvf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleXplbnBvbGJyZm1zYW1ndXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNDg4NjcsImV4cCI6MjA3ODcyNDg2N30.cRxc6STLnhDI2Fm7jADLhhdko50esBNuYOkha3BC0-0
```

⚠️ **보안 주의:** 실제 프로덕션에서는 환경 변수를 직접 코드에 넣지 마세요!

### 2. 빌드 테스트

로컬에서 빌드가 정상적으로 되는지 확인:

```bash
npm run build
npm run preview
```

### 3. Supabase CORS 설정

Supabase 대시보드에서 배포된 도메인을 CORS 허용 목록에 추가하세요.

---

## 📝 Vercel 배포 상세 가이드

### Step 1: GitHub에 코드 푸시
```bash
git add .
git commit -m "배포 준비"
git push origin main
```

### Step 2: Vercel 프로젝트 생성
1. [vercel.com](https://vercel.com) 접속
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 import

### Step 3: 빌드 설정
- **Framework Preset:** Vite
- **Build Command:** `npm run build` (자동 감지)
- **Output Directory:** `dist` (자동 감지)
- **Install Command:** `npm install` (자동 감지)

### Step 4: 환경 변수 설정
Settings → Environment Variables에서 추가:
- `VITE_SUPABASE_URL` = `https://eeyzenpolbrfmsamguvf.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `[your-anon-key]`

### Step 5: 배포
"Deploy" 버튼 클릭 → 자동 배포 완료!

### Step 6: 커스텀 도메인 (선택)
Settings → Domains에서 도메인 추가 가능

---

## 📝 Netlify 배포 상세 가이드

### Step 1: netlify.toml 생성
프로젝트 루트에 `netlify.toml` 파일 생성 (이미 생성됨)

### Step 2: Netlify 프로젝트 생성
1. [netlify.com](https://www.netlify.com) 접속
2. "Add new site" → "Import an existing project"
3. GitHub 저장소 선택

### Step 3: 빌드 설정
- **Build command:** `npm run build`
- **Publish directory:** `dist`

### Step 4: 환경 변수 설정
Site settings → Environment variables → Add variable

### Step 5: 배포
자동으로 배포 시작!

---

## 🔍 배포 후 확인사항

1. **환경 변수 확인**
   - 브라우저 개발자 도구 → Console에서 에러 확인
   - Supabase 연결 테스트

2. **빌드 파일 확인**
   - 배포된 사이트에서 네트워크 탭 확인
   - JS/CSS 파일이 정상 로드되는지 확인

3. **기능 테스트**
   - 로그인/회원가입
   - 문제 풀이
   - 결과 저장

---

## 🚨 문제 해결

### 빌드 실패
- 로컬에서 `npm run build` 테스트
- 빌드 로그 확인
- TypeScript 오류 확인

### 환경 변수 오류
- 배포 플랫폼의 환경 변수 설정 확인
- 변수명이 `VITE_`로 시작하는지 확인
- 재배포 필요

### Supabase 연결 실패
- Supabase 대시보드에서 CORS 설정 확인
- API 키가 올바른지 확인
- 네트워크 탭에서 요청 확인

---

## 💰 비용 비교

| 플랫폼 | 무료 플랜 | 월 트래픽 1000건 기준 |
|--------|----------|---------------------|
| Vercel | 100GB/월 | ✅ 무료 |
| Netlify | 100GB/월 | ✅ 무료 |
| Cloudflare Pages | 무제한 | ✅ 무료 |

**결론:** 모든 플랫폼의 무료 플랜으로 충분합니다!

---

## 📚 추가 리소스

- [Vercel 문서](https://vercel.com/docs)
- [Netlify 문서](https://docs.netlify.com)
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)


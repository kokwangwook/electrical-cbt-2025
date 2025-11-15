# ngrok 외부 접근 설정 가이드

## 1단계: ngrok authtoken 설정

PowerShell 또는 명령 프롬프트에서 다음 명령을 실행하세요:

```bash
ngrok config add-authtoken 317jn7E0Pcz2ZyFCYUvWB6XSdjI_4BnPr1ktJxabCvSi7aUt7
```

## 2단계: 개발 서버 실행

프로젝트 디렉토리에서 개발 서버를 실행하세요:

```bash
npm run dev
```

개발 서버가 `http://localhost:5173`에서 실행됩니다.

## 3단계: ngrok 터널링

**새로운 터미널 창**을 열고 다음 명령을 실행하세요:

```bash
ngrok http 5173
```

또는 더 안정적인 연결을 위해:

```bash
ngrok http 5173 --region ap
```

(ap = Asia Pacific, 한국에 가까운 지역)

## 4단계: 외부 URL 확인

ngrok이 실행되면 다음과 같은 정보가 표시됩니다:

```
Forwarding  https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:5173
```

이 `https://xxxx-xxxx-xxxx.ngrok-free.app` URL을 사용하여 외부에서 접근할 수 있습니다.

## 5단계: ngrok 웹 인터페이스 확인

브라우저에서 `http://127.0.0.1:4040`을 열면 ngrok의 웹 인터페이스를 확인할 수 있습니다.
여기서 요청 로그, 재플레이 등을 확인할 수 있습니다.

## 주의사항

1. **개발 서버가 실행 중이어야 합니다**: ngrok을 실행하기 전에 `npm run dev`로 개발 서버를 먼저 실행해야 합니다.

2. **ngrok 무료 버전 제한**:
   - 세션 시간 제한 (8시간)
   - 연결 수 제한
   - URL이 매번 변경됨

3. **보안**: ngrok은 외부에 노출되므로 개발 환경에서만 사용하세요.

## 자동화 스크립트 (선택사항)

두 개의 터미널을 동시에 실행하는 것이 번거롭다면, 스크립트를 만들 수 있습니다.



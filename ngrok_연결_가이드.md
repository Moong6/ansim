# 케어알림장 — ngrok 연결 가이드

> **이 문서의 성격**: 본인 노트북에서 띄운 케어알림장(백엔드 8000 + 프론트 5173)을 **발표·심사 평가자가 외부에서 접속**하거나 **실제 모바일 기기에서 보호자 화면을 확인**할 수 있도록 ngrok 터널을 연결하는 가이드입니다. 본인 PC가 임시 서버가 되는 구조라, 발표 끝나면 반드시 터널을 종료하세요(어르신·보호자 데이터 보안).

---

## 1. ngrok이란

본인 노트북의 `localhost:포트`에 외부 인터넷에서 접속 가능한 임시 URL을 만들어주는 도구. 클라우드 배포 없이 발표·심사·모바일 테스트에 빠르게 활용할 수 있습니다.

**작동 그림**:
```
[평가자 폰/노트북]  →  https://abc-123.ngrok-free.app  →  본인 노트북 localhost:5173
                          (ngrok 클라우드)              (당신의 프론트엔드)
```

---

## 2. 우리 프로젝트의 특성 — 터널 2개 필요

케어알림장은 백엔드(FastAPI, :8000)와 프론트(Vite, :5173)가 분리되어 있어서, 평가자가 화면을 보려면 **프론트만** 외부에서 접속 가능하면 됩니다. 그런데 프론트가 백엔드를 호출할 때 다음 두 경우로 갈립니다:

### Case A — 프론트가 같은 노트북의 백엔드를 부르는 경우 (PM 권장)
- 평가자가 ngrok 프론트 URL로 접속
- 프론트가 백엔드를 `http://localhost:8000`으로 부르려고 하면 **평가자 브라우저에서는 동작 안 함**
- 해결: 프론트의 API base URL을 **상대 경로**(예: `/api`)로 두거나, **백엔드도 ngrok 터널을 띄워** 절대 URL로 부르기

### Case B — 백엔드도 ngrok 터널로 노출
- 가장 단순. 프론트와 백엔드 각각 ngrok URL 발급
- 프론트의 `.env`에서 `VITE_API_BASE_URL`을 백엔드 ngrok URL로 갈아끼움

**MVP 발표용 권장: Case B**. 설정이 단순하고 환경 분리가 명확합니다.

---

## 3. 설치 및 초기 설정

### 3.1 ngrok 설치

**Windows**:
```bash
# Chocolatey
choco install ngrok

# 또는 ngrok 공식 사이트(https://ngrok.com/download)에서 zip 다운로드
```

**macOS**:
```bash
brew install ngrok/ngrok/ngrok
```

**Linux**:
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

### 3.2 ngrok 계정 및 인증 토큰

1. https://ngrok.com 에서 무료 가입
2. 대시보드 → "Your Authtoken" 복사
3. 본인 노트북에서 인증:
```bash
ngrok config add-authtoken <복사한_토큰>
```

이후 ngrok이 본인 계정과 연동되어, 무료 플랜의 기본 기능(랜덤 도메인 1개 동시 사용)이 활성화됩니다.

### 3.3 무료 플랜 vs 유료 플랜

| 항목 | 무료 (Free) | 유료 (Personal $8/월~) |
|---|---|---|
| 동시 터널 | **1개** | 3개 이상 |
| 도메인 | 매 실행 시 랜덤 (예: `abc-123.ngrok-free.app`) | **고정 도메인 가능** |
| 접속 경고 페이지 | 첫 접속 시 안내 페이지 (이용약관 동의) | 없음 |
| 트래픽 한도 | 월 1GB | 충분 |

**발표 단발성 데모면 무료로 충분합니다**. 단 두 가지 주의:
- **동시 터널 1개 제한**: 백엔드+프론트 둘 다 띄우려면 두 개의 터미널에서 별도 ngrok 프로세스 실행 필요. 무료도 동일 노트북에서 여러 프로세스 띄우는 건 가능하지만, 계정에서 동시에 활성화되는 터널이 1개로 제한됩니다.
  - **해결**: 한 ngrok 프로세스에서 `ngrok.yml` 설정 파일로 멀티 터널 띄우기 (아래 5절). 무료 플랜에서도 작동.
- **발표 직전 URL이 바뀌면 곤란**: 노트북 재시작·터널 종료 시 URL이 변경되어, 평가자에게 미리 공유한 링크가 깨질 수 있음. 발표 시작 직전에 띄우고, 발표 중 절대 끄지 말기.

---

## 4. 가장 단순한 시작 — 프론트만 외부 노출

이 방법은 프론트의 API 호출이 **상대 경로**로 짜여 있고, Vite dev server가 백엔드로 프록시하는 경우에만 동작합니다.

### 4.1 Vite 프록시 설정 확인

`frontend/vite.config.ts`에 다음 같은 설정이 있어야 합니다:

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api':    'http://localhost:8000',
      '/static': 'http://localhost:8000',
    }
  }
})
```

이러면 프론트가 `/api/notices`로 호출하면 Vite가 `localhost:8000/api/notices`로 프록시. ngrok도 같은 구조로 작동합니다.

### 4.2 실행

```bash
# 터미널 1: 백엔드 띄우기
cd backend
uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트 띄우기
cd frontend
npm run dev   # http://localhost:5173

# 터미널 3: ngrok 프론트 터널
ngrok http 5173
```

ngrok 터미널에 다음과 같이 나옵니다:
```
Forwarding   https://abc-123.ngrok-free.app -> http://localhost:5173
```

이 URL을 평가자에게 공유. 평가자 브라우저에서 첫 접속 시 ngrok 무료 플랜 경고 페이지 → [Visit Site] 클릭 → 로그인 화면 진입.

### 4.3 한계

- Vite dev server는 개발 모드라 빌드된 정적 자산보다 느림
- **HMR(Hot Module Replacement)**이 외부에서는 잘 작동 안 할 수 있어 코드 수정 후 새로고침 필요
- 더 안정적이려면 5절(권장 방식)으로

---

## 5. 권장 방식 — 백엔드·프론트 둘 다 터널 (ngrok.yml)

발표·심사용 권장 방법. 무료 플랜에서도 멀티 터널 설정으로 한 번에 띄울 수 있습니다.

### 5.1 ngrok.yml 설정 파일

홈 디렉토리에 만듭니다 (Windows: `%HOMEPATH%\AppData\Local\ngrok\ngrok.yml`, macOS/Linux: `~/.config/ngrok/ngrok.yml`).

```yaml
version: "3"
agent:
  authtoken: <YOUR_NGROK_AUTHTOKEN>

tunnels:
  carealimjang-backend:
    proto: http
    addr: 8000
  carealimjang-frontend:
    proto: http
    addr: 5173
```

### 5.2 실행

```bash
# 터미널 1: 백엔드
cd backend
uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트
cd frontend
npm run dev

# 터미널 3: ngrok 멀티 터널
ngrok start --all
```

ngrok이 두 URL을 한 번에 보여줍니다:
```
Forwarding   https://api-abc.ngrok-free.app    -> http://localhost:8000
Forwarding   https://web-xyz.ngrok-free.app    -> http://localhost:5173
```

### 5.3 프론트엔드 환경 변수 갱신

프론트가 백엔드를 ngrok URL로 호출하도록 `.env` 또는 `.env.local`을 수정:

```env
VITE_API_BASE_URL=https://api-abc.ngrok-free.app
```

저장 후 프론트 dev server를 **재시작** (Vite는 env 변경 시 자동 리로드 안 함).

이후 평가자에게 공유할 URL은 **프론트 ngrok URL** (`https://web-xyz.ngrok-free.app`) 하나면 됩니다.

---

## 6. ⚠️ 우리 프로젝트 특유의 함정 — 반드시 확인

### 6.1 백엔드 CORS 설정 추가

FastAPI의 `app/main.py`에 CORS 미들웨어가 있을 텐데, 보통 `localhost:5173`만 허용으로 짜여 있습니다. ngrok URL 추가가 필요합니다.

**현재 추정 설정**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**ngrok용 확장**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://web-xyz.ngrok-free.app",   # 프론트 ngrok URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

매번 ngrok URL이 바뀌니까, 더 편하게 하려면 환경 변수로 분리하거나 정규식 패턴 허용:

```python
import re
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.ngrok-free\.app|http://localhost:5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

⚠️ `allow_origin_regex`로 `.ngrok-free.app` 전체를 허용하면 **누구나 만든 ngrok URL이 우리 백엔드에 접근 가능**해집니다. 발표 직후엔 이 설정을 원복.

### 6.2 FastAPI Host Header 검증 (있다면)

FastAPI의 `TrustedHostMiddleware`를 쓰고 있다면 ngrok 도메인 추가:

```python
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.ngrok-free.app"]
)
```

쓰고 있지 않다면 무시.

### 6.3 사진 업로드 URL 검증

6차·7차에서 사진 업로드 응답이 `/static/meals/...` `/static/albums/...` 같은 **상대 경로 URL**을 돌려줍니다. 백엔드 서버 검증도 `/static/...` 시작 패턴만 검사합니다. **ngrok URL이 들어가 있어도 문제 없습니다** — 클라이언트가 받는 URL은 상대 경로니까.

다만 만약 어딘가에 절대 URL을 만드는 코드가 있다면:
```env
STATIC_BASE_URL=https://api-abc.ngrok-free.app/static
```

같이 ngrok URL로 갈아끼워야 사진이 보입니다. 작업 지시문 단계에서 명시했던 환경 변수 분리가 여기서 활용됩니다.

### 6.4 Vite의 ngrok 허용 호스트 설정

Vite 5+ 버전은 보안상 `allowedHosts` 검증이 있어, 외부 도메인으로 접속하면 거부할 수 있습니다.

```ts
// vite.config.ts
export default defineConfig({
  server: {
    host: true,  // 0.0.0.0 바인딩
    allowedHosts: [
      'localhost',
      '.ngrok-free.app',   // ngrok 도메인 와일드카드
    ],
    // ... 기존 설정
  }
})
```

`Blocked request. This host is not allowed.` 오류가 나면 이 설정이 누락된 것입니다.

### 6.5 ngrok 무료 플랜 경고 페이지

무료 플랜은 첫 접속 시 "이 사이트는 ngrok을 통해 노출됨" 안내 페이지가 뜨고, 이용자가 [Visit Site]를 눌러야 통과합니다. 발표 시 평가자에게 미리 안내하세요.

**우회 방법**: 요청 헤더에 `ngrok-skip-browser-warning: true` 추가. 프론트에서 API 호출 시 자동 첨부:

```ts
// frontend/src/api/client.ts
axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
})
```

이러면 백엔드 API 호출은 경고 없이 통과. **단, 프론트 URL 자체를 평가자가 처음 열 때는 경고 페이지가 한 번 뜸**. [Visit Site] 한 번 누르면 같은 세션 내 안 뜸.

---

## 7. ⚠️ 보안 — 발표 전후 체크리스트

ngrok을 켜는 동안엔 본인 노트북이 **인터넷 전체에 노출**됩니다. 어르신 의료 정보·보호자 연락처 같은 민감 데이터가 들어 있는 프로젝트라 더더욱 주의.

### 발표 전 (켜기 전)
- [ ] 시드 데이터에 실제 어르신 정보가 안 들어가 있는지 확인. 김민지/박서준 같은 가상 인물만.
- [ ] DB에 본인 신상·실제 가족 정보가 없는지 한 번 더 확인.
- [ ] .env 파일이 git에 올라가 있지 않은지 확인 (`git status` / `.gitignore`에 `.env` 포함).
- [ ] Gemini API 키가 코드에 하드코딩되어 있지 않은지 확인. 모두 환경 변수로.

### 발표 중 (켜져 있는 동안)
- [ ] 평가자에게만 URL 공유, SNS·블로그 등 공개 채널에 노출하지 않음.
- [ ] 노트북 잠금 화면 끄지 말기 (잠그면 ngrok 프로세스 죽을 수 있음, OS에 따라).
- [ ] WiFi 끊기지 않는 환경에서 발표 (모바일 핫스팟 대비책으로 준비).

### 발표 후 (즉시 끄기)
- [ ] 모든 터미널에서 ngrok 프로세스 `Ctrl+C`로 종료.
- [ ] 백엔드 CORS 설정을 원복 (`localhost:5173`만 허용으로).
- [ ] 평가자에게 공유한 URL이 **404로 떨어지는지** 직접 확인.
- [ ] 다음에 또 발표할 일이 있으면 `ngrok.yml`은 그대로 두고 토큰만 보관.

---

## 8. 트러블슈팅

### 평가자가 접속했는데 로그인 화면이 깨져 보임
- 원인: Vite의 정적 자산 경로가 잘못 잡힘
- 해결: `vite.config.ts`의 `base: '/'` 확인, 또는 `host: true` 추가

### 로그인은 되는데 API 호출이 모두 실패 (CORS 에러)
- 원인: 백엔드 CORS에 ngrok URL 미허용
- 해결: 6.1절의 CORS 설정에 ngrok URL 추가, 백엔드 재시작

### 사진이 안 보임 (이미 업로드된 사진)
- 원인: 사진 URL이 절대 URL(`http://localhost:8000/static/...`)로 박혀 있음
- 해결:
  - DB의 `photos` JSONB 컬럼에 저장된 URL이 상대 경로(`/static/...`)인지 확인
  - 절대 URL로 저장된 게 있다면 `UPDATE meal_log SET photos = ...` 로 갱신
  - 향후 신규 업로드는 정상 동작

### "Blocked request. This host is not allowed."
- 원인: Vite의 `allowedHosts` 검증
- 해결: 6.4절 참고

### "ERR_NGROK_3200 - Tunnel not found"
- 원인: ngrok URL이 만료됨 (무료 플랜은 ngrok 프로세스 죽으면 URL 사라짐)
- 해결: ngrok 재실행 후 새 URL 평가자에게 다시 공유

### 첫 화면에서 ngrok 경고 페이지가 뜨고 [Visit Site] 안 보임
- 원인: 모바일 화면에서 페이지가 잘림
- 해결: 가로 모드로 보거나, 평가자 데스크탑 사용 권장

### 발표 중 ngrok이 갑자기 끊김
- 원인: 무료 플랜 트래픽 한도(월 1GB) 초과, 또는 네트워크 불안정
- 해결: ngrok 재실행 후 새 URL 공유. 평소 트래픽이 1GB를 넘진 않지만, 발표·심사가 길어지면 대비.

---

## 9. 발표 시연 추천 흐름

평가자가 한 명의 ngrok URL로 접속해 다음 흐름을 따라가게 합니다.

1. **직원 로그인** (`/login`): `seojun@happy.kr / test1234`
2. **홈 그리드 8카드** 둘러보기 — 1차부터 8차까지의 결과물이 한눈에
3. **알림장 작성 시연** — 박정호(와상)로 생성 → AI가 "산책" 같은 거짓 서술 안 함
4. **보호자 문의 처리** — 김보람 UNREAD 문의에 확인 → 답변 작성 라이브 시연
5. **로그인 화면 하단 "가족 로그인 →" 링크** 클릭 → 보호자 로그인으로 전환
6. **보호자 로그인** (`/login-parent`): `boram@family.kr / test1234`
7. **보호자 홈에 답변 도착 빨간 점** → 문의하기 카드 클릭 → 답변 확인
8. **앨범 격리 시연**: 보호자를 `hyeonu@family.kr`로 갈아 끼우면 "실버 체조 시간" 활동이 안 보임 (박정호 와상이라 미참여)

8단계 흐름이 1~8차의 핵심 메시지를 자연스럽게 모두 보여줍니다.

---

## 10. 참고 자료

- ngrok 공식 문서: https://ngrok.com/docs
- ngrok config 파일 명세: https://ngrok.com/docs/agent/config/
- FastAPI CORS: https://fastapi.tiangolo.com/tutorial/cors/
- Vite Server Options: https://vitejs.dev/config/server-options.html

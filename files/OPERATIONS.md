# 케어알림장 — 통합 운영 가이드 (OPERATIONS.md)

> **이 문서의 성격**: 케어알림장을 **처음 세팅하는 사람부터 발표 당일 시연하는 사람까지** 한 흐름으로 따라갈 수 있는 단일 운영 가이드입니다. 그동안 만든 14개 문서가 흩어져 있어서 무엇부터 봐야 할지 막막했다면, 이 문서가 진입점입니다.
>
> **사용 흐름**: 0장(전제 확인) → 1장(첫 환경 세팅, 1회만) → 2장(매번 실행) → 3장(발표 준비) → 4장(트러블슈팅).

---

## 0. 시작 전 확인 사항

### 0.1 OS

이 가이드는 **Windows 기준**으로 작성되었습니다(에러 로그상 Windows 환경 확인). macOS/Linux 사용자는 `.bat` 대신 `.sh`를 사용하시면 됩니다 — 동일한 내용이 두 형식으로 제공됩니다.

### 0.2 필수 설치 도구

| 도구 | 버전 | 용도 |
|---|---|---|
| Python | 3.11+ | 백엔드 |
| Node.js | 18+ | 프론트 |
| Docker Desktop | 최신 | PostgreSQL 실행 |
| Git | 최신 | 코드 관리 |
| ngrok | 최신 | 발표 배포 (3장) |

설치 확인:
```bash
python --version    # Python 3.11.x
node --version      # v18.x.x 이상
docker --version    # Docker version 24.x 이상
git --version
ngrok version       # 3.x.x
```

### 0.3 ngrok 인증 (1회만, 발표용)

발표 단계에서만 필요. https://ngrok.com 에서 무료 가입 후 인증 토큰 발급:
```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

### 0.4 폴더 구조 가정

```
ansim/                         # 프로젝트 루트
├── backend/                   # FastAPI 백엔드
│   ├── app/
│   ├── alembic/
│   ├── uploads/               # 사용자 업로드 (.gitignore)
│   ├── static/                # 시드 샘플 사진 (git 포함)
│   ├── init_db.sql
│   ├── .env
│   └── pyproject.toml
├── frontend/                  # React + Vite 프론트
│   ├── src/
│   ├── .env
│   └── package.json
├── scripts/                   # 자동화 스크립트 (이번에 추가)
│   ├── setup.bat
│   ├── setup.sh
│   ├── start-all.bat
│   └── start-all.sh
├── docker-compose.yml         # DB 컨테이너 정의
└── docs/                      # 핸드오프 문서들 (8개 스프린트 + 패치)
```

스크립트는 **프로젝트 루트에서 실행**한다고 가정합니다.

---

## 1. 첫 환경 세팅 (1회만 실행)

처음 프로젝트를 받았을 때, 또는 환경이 망가져서 처음부터 다시 세팅할 때 이 흐름을 따릅니다.

### 1.1 코드 받기 및 .env 만들기

```bash
git clone <repo-url> ansim
cd ansim
```

**백엔드 `.env`** (`backend/.env`):
```env
# DB
DATABASE_URL=postgresql://carealimjang:carealimjang@localhost:5432/carealimjang

# AI
GEMINI_API_KEY=<발급받은_키>
GEMINI_MODEL=gemini-3.5-flash

# JWT
JWT_SECRET=<랜덤_32자_이상>
JWT_ALGORITHM=HS256

# 분류 임계치 (5차)
CLASSIFICATION_THRESHOLD=0.6

# 사진 업로드 (6·7차)
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE_MB=5
UPLOAD_ALLOWED_EXT=jpg,jpeg,png,webp
STATIC_BASE_URL=http://localhost:8000/static
```

**프론트 `.env`** (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:8000
```

⚠️ `.env`는 절대 git에 올리지 마세요. `.gitignore`에 들어 있어야 합니다.

### 1.2 DB 컨테이너 시작 + 마이그레이션 + 시드

`scripts/setup.bat` 또는 `scripts/setup.sh` 한 번 실행으로 끝납니다. 내부에서:
1. Docker Compose로 PostgreSQL 컨테이너 띄움
2. DB 준비 대기 (헬스 체크)
3. 백엔드 의존성 설치 (`pip install` 또는 `uv sync`)
4. 1차 시드(`init_db.sql`) 적용
5. 이후 스프린트 마이그레이션 Alembic으로 적용
6. 프론트 의존성 설치 (`npm install`)

**Windows**:
```bash
scripts\setup.bat
```

**macOS/Linux**:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

세팅이 정상 종료되면:
- `localhost:5432`에 Postgres 컨테이너 동작 중
- DB에 1~8차 + 패치까지의 모든 테이블·시드 적용됨
- 백엔드·프론트 의존성 설치 완료
- 다음 단계로 진행 가능

### 1.3 세팅 검증

```bash
# DB 컨테이너 확인
docker ps   # carealimjang-db 컨테이너 보임

# DB 접속 확인 (선택)
docker exec -it carealimjang-db psql -U carealimjang -d carealimjang -c "\dt"
# album, album_resident, app_user, ... 등 테이블 목록이 나옴
```

테이블이 안 보이면 4장(트러블슈팅) 참조.

---

## 2. 매번 실행 (개발 모드)

설치가 끝난 뒤 매일 작업할 때.

### 2.1 일괄 실행 (백엔드 + 프론트, ngrok 없이)

**Windows**:
```bash
scripts\start-all.bat
```

**macOS/Linux**:
```bash
./scripts/start-all.sh
```

내부에서:
1. DB 컨테이너가 안 떠 있으면 시작
2. 새 터미널 창에서 백엔드 시작 (`uvicorn app.main:app --reload --port 8000`)
3. 새 터미널 창에서 프론트 시작 (`npm run dev`)
4. 정상 동작하면:
   - 백엔드: `http://localhost:8000` (Swagger: `/docs`)
   - 프론트: `http://localhost:5173`

기본 모드는 ngrok 없이 로컬만. 발표 직전엔 3장으로.

### 2.2 종료

각 터미널에서 `Ctrl+C`. DB 컨테이너는 백그라운드에서 계속 동작 — 필요 시 `docker compose down`으로 종료.

### 2.3 코드 수정 후

- **프론트**: HMR(Hot Module Replacement)로 자동 반영. 새로고침 거의 안 함.
- **백엔드**: `--reload` 플래그로 파일 변경 시 자동 재시작.
- **DB 스키마 변경**: Alembic 마이그레이션 작성 후 `alembic upgrade head` 수동 실행.

### 2.4 테스트 계정 (시드)

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 요양보호사 | minji@happy.kr | test1234 |
| 사회복지사 | seojun@happy.kr | test1234 |
| 관리자 | admin@happy.kr | test1234 |
| 외국인 직원 | huong@happy.kr | test1234 |
| 보호자 (김순자 가족) | boram@family.kr | test1234 |
| 보호자 (박정호 가족) | hyeonu@family.kr | test1234 |

---

## 3. 발표 준비 (ngrok 통합 실행)

발표·심사 직전에 평가자가 외부에서 접속하도록 ngrok 터널을 띄웁니다. 자세한 배경은 `ngrok_연결_가이드.md` 참조 — 여기선 실행 순서만.

### 3.1 사전 확인

발표 30분 전에 한 번:
- [ ] `backend/app/main.py`의 CORS 설정에 `allow_origin_regex=r"https://.*\.ngrok-free\.app|http://localhost:5173"` 같이 ngrok 도메인 허용 추가
- [ ] `frontend/vite.config.ts`의 `server.allowedHosts`에 `.ngrok-free.app` 추가
- [ ] `ngrok.yml`이 홈 디렉토리에 있고 authtoken 들어가 있는지 (1회만 설정, 이후 그대로 사용)

`ngrok.yml` 예시 (Windows: `%HOMEPATH%\AppData\Local\ngrok\ngrok.yml`, macOS/Linux: `~/.config/ngrok/ngrok.yml`):
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

### 3.2 발표용 일괄 실행

**Windows**:
```bash
scripts\start-all.bat --ngrok
```

**macOS/Linux**:
```bash
./scripts/start-all.sh --ngrok
```

내부에서:
1. DB 컨테이너 시작
2. 백엔드·프론트 시작
3. **`ngrok start --all` 실행 (멀티 터널)**
4. 잠시 대기 후 `http://localhost:4040/api/tunnels`에서 현재 ngrok URL 자동 조회
5. 콘솔에 명확히 출력:
```
======================================
프론트엔드 URL (평가자에게 공유):
  https://web-xyz.ngrok-free.app

백엔드 URL (API):
  https://api-abc.ngrok-free.app
======================================
```
6. **프론트 `.env`의 `VITE_API_BASE_URL`을 백엔드 ngrok URL로 자동 갱신** (스크립트가 처리)
7. 프론트 dev server 재시작 (Vite는 env 변경 시 자동 리로드 안 함)

### 3.3 평가자에게 공유

콘솔에 출력된 **프론트엔드 URL** 한 줄만 평가자에게 공유. 백엔드 URL은 내부용이라 공유 안 해도 OK.

ngrok 무료 플랜은 첫 접속 시 경고 페이지가 뜹니다 — 평가자에게 "한 번 [Visit Site] 누르라"고 안내하거나, 헤더 우회 적용된 코드 확인.

### 3.4 발표 후 즉시 종료

발표 끝나면 즉시:
1. 모든 터미널에서 `Ctrl+C` (백엔드·프론트·ngrok)
2. 평가자에게 공유한 URL이 404로 떨어지는지 직접 확인
3. CORS 설정을 원복하고 싶다면 `backend/app/main.py`에서 ngrok 도메인 제거 (선택, 안 해도 보안상 큰 문제 없음 — 어차피 ngrok URL 죽음)

ngrok을 켜두면 본인 노트북이 인터넷에 계속 노출됩니다. **발표 끝나면 반드시 끄기**.

### 3.5 추천 시연 흐름

평가자가 한 URL로 접속해 다음 8단계를 따라가게 합니다.

1. **직원 로그인** (`seojun@happy.kr / test1234`) → 홈 그리드 8카드
2. **알림장 작성** — 박정호(와상)로 생성 → AI가 "산책" 거짓 서술 안 함
3. **주간 리포트** — 박정호로 생성 → 거짓 활동 없음
4. **앨범 진입** — 시드 4건(어버이날·체조·산책·생신잔치) 그리드 확인
5. **보호자 문의 처리** — 김보람 UNREAD 문의 확인 → 답변 작성 라이브
6. **로그인 화면 전환 링크** 클릭 → 보호자 로그인으로
7. **보호자 로그인** (`boram@family.kr / test1234`) → 답변 도착 빨간 점
8. **앨범 권한 격리** — `hyeonu@family.kr`로 전환 → "실버 체조 시간"이 안 보임 (박정호 와상)

8단계로 1~8차의 핵심 메시지가 자연스럽게 전부 시연됩니다.

---

## 4. 트러블슈팅

### 4.1 DB 컨테이너가 시작 안 됨

```
Error: port 5432 is already allocated
```
- 원인: 호스트의 5432 포트가 이미 사용 중 (다른 Postgres 인스턴스)
- 해결:
  ```bash
  # 기존 Postgres 종료 (Windows 서비스 또는 다른 컨테이너)
  docker ps   # 5432 점유 중인 컨테이너 확인
  docker stop <컨테이너_이름>
  # 또는 docker-compose.yml의 포트를 5433:5432로 변경
  ```

### 4.2 503 UNAVAILABLE — Gemini high demand

이전 대화에서 보고된 에러. Gemini 서버 일시적 과부하.
- 즉시 해결: 1~2분 후 재시도
- 코드 차원: `services/report_service.py`에 tenacity 재시도 강화 (exponential backoff)
- 발표 직전 한 번 미리 호출해 캐싱 권장

### 4.3 CORS 에러

```
Access to fetch at 'https://api-abc.ngrok-free.app/api/...' from origin 'https://web-xyz.ngrok-free.app' has been blocked by CORS policy
```
- 원인: 백엔드 CORS에 ngrok URL 미허용
- 해결: 3.1절 CORS 정규식 설정 추가 후 백엔드 재시작

### 4.4 사진이 안 보임

- 원인: 사진 URL이 절대 URL(`http://localhost:8000/static/...`)로 박혀 있고 ngrok 환경에서 로컬 접근 불가
- 해결: DB의 `photos` JSONB가 상대 경로(`/static/...`)인지 확인. 절대 URL이라면 `UPDATE`로 갱신.

### 4.5 Vite "Blocked request. This host is not allowed."

- 원인: Vite의 `allowedHosts` 검증
- 해결: `vite.config.ts`의 `server.allowedHosts`에 `.ngrok-free.app` 추가, 프론트 재시작

### 4.6 ngrok URL이 변경됨 (무료 플랜)

- 무료 플랜은 ngrok 프로세스 죽으면 URL 사라짐. 다시 띄우면 새 URL.
- 발표 중 절대 끄지 마세요. 발표 시작 직전에 띄우고 URL 그대로 유지.

### 4.7 알림장 작성에서 박정호로 생성했는데 "걸으셨다"가 나옴

- 심각한 버그. 1차 precautions 주입이 안 되고 있음
- 즉시 확인:
  - `services/gemini_service.py`에서 프롬프트에 `resident.precautions`가 System Context로 들어가 있는지
  - `resident.precautions` 컬럼에 와상·휠체어 정보가 실제로 들어가 있는지 (`SELECT precautions FROM resident WHERE id=3`)
- 발표 전 반드시 검증

### 4.8 8차 답변이 등록됐는데 상태가 ANSWERED로 안 바뀜

- 원인: 트랜잭션 처리 누락. 답변 INSERT만 되고 inquiry.status UPDATE 안 됨
- 해결:
  ```python
  async with db.begin():
      answer = await create_answer(...)
      await update_inquiry_status(inquiry_id, 'ANSWERED')
  ```
- 8차 핸드오프 [S8-2] 작업 지시문 참조

---

## 5. 폴더·파일 인덱스

### 본 설계 (8개 핸드오프)
- `docs/개발_핸드오프_문서_v3.md` — 1차 MVP (가장 중요한 기반)
- `docs/2차스프린트_다국어_핸드오프.md`
- `docs/3차스프린트_주간리포트_핸드오프.md`
- `docs/4차스프린트_홈_어르신_공지_핸드오프.md`
- `docs/5차스프린트_보호자채널_AI분류_핸드오프.md`
- `docs/6차스프린트_식단표_일정표_핸드오프.md`
- `docs/7차스프린트_앨범_핸드오프.md`
- `docs/8차스프린트_문의답변_핸드오프.md`

### 보조 패치
- `docs/UX_미세조정_패치_v1.md`
- `docs/로그인전환링크_패치_v1.md`

### 1차 코딩 단계별 지시문
- `docs/작업지시문_Prompt_Playbook.md`

### DB 시드
- `backend/init_db.sql` (1차)

### 운영 가이드
- `README.md` — 사용자 입장 (직원·보호자·관리자) 안내
- `OPERATIONS.md` — **이 문서** (개발자·운영자 입장)
- `ngrok_연결_가이드.md` — ngrok 상세
- `docker-compose.yml` — DB 컨테이너 정의
- `scripts/setup.{bat,sh}` — 초기 환경 세팅
- `scripts/start-all.{bat,sh}` — 매번 일괄 실행

### 진입점 선택 (어느 문서를 먼저?)
- **개발자가 처음 프로젝트 받았을 때**: 이 `OPERATIONS.md` → README.md
- **각 스프린트 자세히 이해**: 본 설계 8개를 순서대로
- **발표 준비**: 이 문서 3장 + `ngrok_연결_가이드.md`
- **사용자 시나리오 시연**: README.md의 3개 시점 시나리오

# 케어알림장 (CareAlimjang)

요양원·주야간보호센터의 요양보호사가 짧은 메모 몇 줄로 보호자에게 보낼 따뜻한 알림장을 만들고, 한 주의 흐름을 종합 편지로 정리하며, 보호자 문의를 AI가 자동 분류하고 직원이 답변하는 — 케어 커뮤니케이션의 양방향 사이클을 완성한 서비스입니다.

> **상태**: 1~8차 스프린트 설계 완료 + UX 미세조정 패치 + 로그인 전환 링크 패치. 실제 구현은 핸드오프 문서를 기준으로 진행됩니다.

---

## 핵심 가치

직원이 "점심 미역국 절반 / 컨디션 좋음" 같은 짧은 메모와 정형 상태 칩(건강·기분·식사·투약)만 입력하면, AI(Gemini)가 어르신의 기저질환을 반영해 보호자에게 보낼 따뜻한 알림장 3안을 생성합니다. 직원은 그중 한 안을 골라 다듬어 전송합니다. AI는 어르신의 `precautions`(예: "와상 환자, 휠체어 사용 필수")를 시스템 프롬프트로 주입받아 **있을 수 없는 활동을 지어내지 않습니다** — 와상 환자에게 "산책 다녀오셨다" 같은 거짓 서술이 나오지 않습니다.

보호자는 본인 어르신의 알림장·주간 리포트·시설 공지·앨범·식단·일정을 한 화면에서 받고, 궁금한 점은 문의로 작성합니다. AI가 자동 분류한 문의를 직원이 카테고리별로 처리하고 답변을 작성하면, 보호자는 답변을 즉시 확인합니다.

---

## 기능 한눈에 (1~8차 누적)

| 스프린트 | 기능 | 사용자 |
|---|---|---|
| 1차 | 일간 알림장 작성·전송 (AI 3안 + 톤 + 다듬기 + 4대 방어 로직) | 직원 |
| 2차 | 다국어 메모 입력 (외국어 → 한국어 자동 변환) | 외국인 직원 |
| 3차 | 주간 안심 리포트 (한 주 데이터를 AI가 종합 편지로) | 직원 → 보호자 |
| 4차 | 홈 그리드 + 어르신 특이사항 관리 + 공지사항 | 직원 |
| 5차 | 보호자 채널 (로그인·조회·문의) + AI 문의 5분류 | 보호자·직원 |
| 6차 | 식단표(하루 단위 사진+텍스트) + 일정표(공휴일·생일·행사) | 직원·보호자 |
| 7차 | 앨범 (활동 단위 사진 묶음 + 보호자 권한 자동 필터) | 직원·보호자 |
| **8차** | **보호자 문의 답변 작성 (양방향 소통 완성)** | **직원·보호자** |

**추가 패치 (사용자 경험 다듬기)**:

| 패치 | 내용 |
|---|---|
| UX 미세조정 | 보호자 화면 AI 흔적 제거 + 상태값 아이콘 라벨 + AI 본문에 자연스러운 이모지 |
| 로그인 전환 링크 | 직원 ↔ 보호자 로그인 화면 상호 전환 안내 링크 |

---

## 기술 스택

- **백엔드**: Python 3.11+ / FastAPI / Pydantic v2 / SQLAlchemy 2.0 / Alembic / Uvicorn
- **AI**: Gemini `gemini-3.5-flash` (Structured Output, `.env`의 `GEMINI_MODEL`로 분리)
- **DB**: PostgreSQL 16 (JSONB 정형 저장, 시설 격리, soft delete, 부분 인덱스)
- **프론트**: React + Vite + TypeScript + Tailwind + Zustand
- **사진**: 로컬 파일 시스템 `/uploads` (운영 시 S3 교체 단서)
- **패키지**: uv 또는 pip + venv

---

## 빠른 시작

### 1) 환경 변수

`.env` 파일을 백엔드 루트에 만듭니다.

```env
# DB
DATABASE_URL=postgresql://user:pass@localhost:5432/carealimjang

# AI
GEMINI_API_KEY=<your-key>
GEMINI_MODEL=gemini-3.5-flash

# JWT
JWT_SECRET=<random-32-chars-or-more>
JWT_ALGORITHM=HS256

# 분류 임계치 (5차)
CLASSIFICATION_THRESHOLD=0.6

# 사진 업로드 (6·7차)
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE_MB=5
UPLOAD_ALLOWED_EXT=jpg,jpeg,png,webp
STATIC_BASE_URL=http://localhost:8000/static
```

### 2) DB 띄우기

```bash
docker run -d --name pg-carealimjang \
  -e POSTGRES_USER=user -e POSTGRES_PASSWORD=pass \
  -e POSTGRES_DB=carealimjang -p 5432:5432 postgres:16

# 1차 시드 적용
psql $DATABASE_URL < init_db.sql

# 이후 스프린트별 마이그레이션 적용 (Alembic 권장)
cd backend && alembic upgrade head
```

### 3) 백엔드 실행

```bash
cd backend
uv sync   # 또는 pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`http://localhost:8000/docs`에서 Swagger 자동 문서 확인.

### 4) 프론트 실행

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

---

## 테스트 계정 (시드)

| 역할 | 이메일 | 비밀번호 | 비고 |
|---|---|---|---|
| 요양보호사 | minji@happy.kr | test1234 | 김민지, 일반 직원 |
| 사회복지사 | seojun@happy.kr | test1234 | 박서준, 식단·일정·공지·앨범 작성 권한 |
| 관리자 | admin@happy.kr | test1234 | 모든 권한 |
| 외국인 직원 | huong@happy.kr | test1234 | 후엉, 베트남어 기본 (2차) |
| 보호자 | boram@family.kr | test1234 | 김보람, 김순자 어르신 가족 |
| 보호자 | jiwon@family.kr | test1234 | 이지원, 이복남 어르신 가족 |
| 보호자 | hyeonu@family.kr | test1234 | 박현우, 박정호 어르신 가족 |

직원은 `/login`, 보호자는 `/login-parent`로 로그인. 두 로그인 화면 하단에 상호 전환 링크 있음.

---

## 🏥 요양보호사 입장 — 서비스 이용 방법

직원으로 로그인하면 8개 카드의 홈 그리드를 만나게 됩니다. 카드별 동선과 테스트 시나리오를 정리했습니다.

### 시나리오 1 — 일간 알림장 작성 (가장 핵심)

**테스트 계정**: `minji@happy.kr / test1234`. 박정호(와상) 어르신 담당이라 와상 시연 가능.

1. `/login`에서 로그인 → `/home`
2. **알림장 카드** 클릭 → `/dashboard`
3. **S1**: 오늘 공통 프로그램 (체크박스, 기본 전체 체크)
4. **S2**: 담당 어르신 카드 그리드 (미작성 우선 정렬, 진행률 표시)
5. **박정호 어르신 카드 클릭** (와상 환자, AI 안전성 시연용)
6. **S3 작성 영역**:
   - 공통 프로그램: 그대로 체크 또는 일부 해제
   - 상태 칩: 건강·기분·식사 (필수, 라디오), 투약 (선택)
   - 특이사항 메모: 한국어 또는 외국어 입력. 음성 입력 버튼 지원
   - 톤: 친근 / 정중(기본) / 공감·위로
7. **[AI로 알림장 생성]** → 3~5초 후 3안 표시
8. **S4**: A/B/C 탭 중 마음에 드는 안 선택 후 본문 직접 수정 가능. UX 패치로 본문에 따뜻한 이모지가 자연스럽게 들어가 있음.
9. **[맞춤법·표현 다듬기]** (1회만) — AI가 한 번 더 다듬음
10. **[전송하기]** → S2 카드가 ✅로 갱신

**확인 포인트** — 박정호 어르신(와상)으로 생성 시 본문에 "걸으셨다 / 산책 다녀오셨다" 같은 거짓 서술이나 🚶 같은 활동 이모지가 **나오지 않아야** 합니다.

### 시나리오 2 — 외국어 메모로 알림장 작성 (2차)

**테스트 계정**: `huong@happy.kr / test1234` (베트남 직원)

1. 후엉으로 로그인 → 알림장 화면
2. 담당 어르신 선택 → S3 언어 칩이 자동으로 🇻🇳 베트남어
3. 베트남어로 메모 입력 (예: "Ăn hết nửa bát canh, tâm trạng vui vẻ")
4. **[AI로 알림장 생성]** → 결과는 한국어
5. 검수 후 전송

### 시나리오 3 — 작성한 알림장 수정·재전송

1. S2 어르신 카드가 ✅(작성완료) 상태일 때 다시 클릭
2. 과거 알림장이 읽기 전용으로 표시
3. **[수정하여 재전송하기]** → 작성 모드로 전환 (상태값·메모 복원)
4. 수정 후 전송 → 새 행이 version+1로 INSERT (append-only)

### 시나리오 4 — 주간 안심 리포트 (3차)

1. 홈의 **주간 리포트** 카드 → `/reports`
2. 담당 어르신 선택, 주 선택 (기본 = 지난주)
3. **[리포트 생성]** → 데이터 분기:
   - 기록 0일 → 차단
   - 1~2일 → confirm 모달
   - 3일 이상 → 정상 생성
4. R2(통계 요약, 코드 집계) 즉시 표시, R3(AI 편지) 잠시 후
5. 편지 본문 직접 편집 가능. **[다시 생성]** 1회 사용
6. **[전송하기]**

### 시나리오 5 — 어르신 특이사항 편집 (4차)

1. 홈의 **어르신** 카드 → `/residents`
2. 좌측 담당 어르신 목록에서 박정호 선택
3. 우측에 기본 정보 + precautions 편집 영역
4. precautions 한 줄 추가 (예: "당뇨 진단 추가, 단 음식 제한")
5. **[수정 사항 저장]** → "다음 알림장 생성부터 반영"
6. 알림장 카드로 돌아가 박정호로 생성 → 새 주의사항이 반영되는지 확인

### 시나리오 6 — 공지사항 (4차)

1. 홈의 **공지사항** 카드 → `/board`
2. **[+ 새 공지 작성]** → 제목·본문·저장
3. 본인 글만 [수정][삭제] 아이콘 노출 (ADMIN은 예외로 모든 글 가능)

### 시나리오 7 — 보호자 문의 처리 + 답변 작성 (5·8차) ⭐

문의 처리는 5차에서, 답변 작성은 **8차에서 신규**.

1. 홈의 **보호자 문의** 카드 클릭. "미확인 N건 / 답변 대기 M건" 두 줄로 카운트 표시.
2. `/inquiries` 진입
3. 상단 카테고리 필터: [전체][건강][행정][면회][식단][기타]
4. 상태 필터: **[전체][답변 대기만][답변 완료]** (8차 신규)
5. 카드 점:
   - 🔴 빨강 = UNREAD (미확인)
   - 🟠 주황 = READ (확인했으나 답변 대기) — 8차 신규
   - 점 없음 = ANSWERED (답변 완료)
6. 카드 클릭 → 상세
7. 상세 화면에 어르신 정보 + precautions 자동 표시 (직원이 맥락 즉시 파악)

**8차 답변 작성 흐름**:

| 상태 | 직원 동작 |
|---|---|
| UNREAD | [확인 완료로 표시] 버튼만 노출 → 클릭하면 READ로 |
| READ | 답변 작성 폼 자동 노출 (연한 초록 배경). textarea(1~500자) + [답변 등록] |
| ANSWERED | 답변 본문 + 답변자 카드("김민지 요양보호사 · 2026.5.30") 표시. 본인·ADMIN만 [✏ 수정][🗑 삭제] |

답변 수정은 **inline edit**(모달 X) — 본문 자리가 textarea로 변환되어 [저장][취소]. 답변을 삭제하면 상태가 ANSWERED → READ로 복귀 (UNREAD 아님, 직원이 확인한 사실은 유지).

**시드 시연 시나리오**:
- 김보람(김순자 가족) HEALTH 문의 = UNREAD → 직원 라이브 시연 (확인 → 답변 작성)
- 박현우(박정호 가족) VISIT 문의 = ANSWERED → 답변이 미리 박혀 있어 보호자 측 답변 확인 시연

### 시나리오 8 — 식단표 등록 (6차)

**테스트 계정**: `seojun@happy.kr` (사회복지사, 작성 권한). 김민지(CAREGIVER)로는 등록 버튼 안 보임.

1. 홈의 **식단표** 카드 → `/meals`
2. 날짜 네비 ←/→ 또는 키보드 화살표 키. **미래 날짜 이동 불가**.
3. 4행 세로(아침/점심/저녁/간식) 중 빈 행 클릭 → 등록 모달
4. 모달:
   - 날짜·식사구분 자동 채움
   - 사진 1~2장 업로드 (1장당 5MB, jpg/jpeg/png/webp)
   - 메뉴 텍스트 줄단위 입력
5. **[저장]**

### 시나리오 9 — 일정표 등록 (6차)

1. 홈의 **일정표** 카드 → `/schedule`
2. 월 네비 [◀] 2026년 5월 [▶]
3. 공휴일은 시드로 이미 등록 (어린이날 빨강 + 🚩)
4. **[+ 일정 등록]** → 모달
5. 유형 선택:
   - 시설 행사: 제목·설명
   - 어르신 생일: 어르신 드롭다운 자동 노출
   - 공휴일: 시드로 충분, 추가 등록 거의 안 함

### 시나리오 10 — 앨범 등록 (7차)

**테스트 계정**: `seojun@happy.kr` 또는 다른 직원. 7차 권한이 사용자 결정으로 CAREGIVER까지 풀려 있음.

1. 홈의 **앨범** 카드 → `/albums`
2. 월/연도 필터로 활동 그리드 (3열) 조회
3. **[+ 활동 등록]** → 모달
4. 모달:
   - 활동명 (필수, 100자) + 활동 날짜 (미래 허용) + 설명 (선택, 500자)
   - 참여 어르신 다중 체크박스 (시설 전체, 이름 검색 input 포함). **최소 1명 필수**
   - 사진 업로드: 드래그앤드롭 + 멀티 선택 (최대 10장). 5장 한 번에 선택 → 클라이언트가 5번 병렬 업로드, 일부 실패해도 나머지 살아남음
5. **[저장]** → 활동 + 어르신 매핑 한 번에 트랜잭션 처리
6. 카드 클릭 → 상세에서 사진 3열 그리드 + 참여 어르신 칩

---

## 👪 보호자 입장 — 서비스 이용 방법

보호자는 직원과 별도 경로로 로그인합니다. 화면 톤은 따뜻한 미색 배경.

**테스트 계정**: `boram@family.kr / test1234` (김보람, 김순자 어르신 가족)

### 시나리오 1 — 로그인 및 홈

1. `/login-parent` (직원과 분리). 화면 하단에 "직원이신가요? 직원 로그인 →" 링크.
2. 이메일·비밀번호 입력 → `/parent/home`
3. 상단 어르신 카드 + 4개 메뉴 카드:
   - **공지사항 → 받은 알림장 → 주간 리포트 → 문의하기**
4. 각 카드에 미확인 카운트 + 빨간 점. 8차 이후 문의 카드에 "**답변 도착 N건**" 카운트 추가.

### 시나리오 2 — 받은 알림장 조회 (UX 패치 적용)

1. **받은 알림장** 카드 → `/parent/notices`
2. 알림장 목록 (최신순). 미확인에 빨간 점
3. 카드 클릭 → 상세
4. 본문 위에 **상태값 카드 4개** (UX 패치 신규):
   ```
   🌟 좋음   😊 좋음   🌱 조금   💊 완료
   건강     기분     식사     투약
   ```
5. 본문 표시 — 직원이 다듬어 보낸 한국어 본문. AI 흔적("(오타 교정본)" 등) 일체 없음.
6. 진입 즉시 `read_at` 갱신 → 목록 복귀 시 빨간 점 사라짐

### 시나리오 3 — 주간 리포트 조회

1. **주간 리포트** 카드 → `/parent/reports`
2. 주차별 카드
3. 상세에 **한 줄 요약** (UX 패치):
   ```
   이번 주는 대부분 😊 좋음 / 🍚 완식 하셨어요 · 기록된 날 5/7일
   ```
4. AI가 쓴 종합 편지 본문 — 자연스러운 이모지(따뜻한 화이트리스트만 사용)
5. 진입 시 `read_at` 자동 갱신

### 시나리오 4 — 공지사항 조회

1. **공지사항** 카드 → `/parent/board`
2. 카드 리스트 (최신순). 보호자는 읽기 전용

### 시나리오 5 — 문의 작성 + 답변 확인 ⭐ (5·8차)

**5차: 문의 작성 (AI 자동 분류)**

1. **문의하기** 카드 → `/parent/inquiries`
2. **[+ 새 문의 작성]** → `/parent/inquiries/new`
3. 안내 문구 (UX 패치): "더 나은 서비스 제공을 위해 AI를 사용 중입니다."
4. 제목(선택) + 본문(필수) 입력
   - 예시: "어머니 요즘 식사를 잘 못 드시는 것 같은데 건강 괜찮으신지 궁금합니다."
5. **카테고리 선택 UI 없음** — AI가 자동 분류
6. **[전송]** → 3~5초 대기 → 토스트 "문의가 등록되었습니다"

**8차: 답변 확인 (보호자 측 새 흐름)**

1. 직원이 답변을 등록하면 보호자 홈에 "**답변 도착 N건**" + 빨간 점 자동 표시
2. **문의하기** 카드 → 목록에서 답변 도착 문의가 우선 정렬
3. 카드에 답변 첫 줄 미리보기 + 빨간 점
4. 카드 클릭 → 상세
5. 본인 문의 본문 + 카테고리 뱃지
6. **답변 영역** (신규):
   - 답변 없으면 "직원이 곧 답변드릴 예정입니다" 회색 안내
   - 답변 있으면: 본문 + 직원 카드 ("김민지 요양보호사 · 2026.5.30")
7. 답변 영역 아래 회색 안내: "추가 문의가 있으시면 새 문의를 작성해 주세요"
8. 진입 시 `answer_read_at` 자동 갱신 → 목록 복귀 시 빨간 점 사라짐

박현우(박정호 가족)로 로그인하면 시드로 박힌 면회 문의 답변을 즉시 확인 가능 — 8차 보호자 측 시연 시금석.

### 시나리오 6 — 식단표 / 일정표 (6차)

1. 보호자 홈에서 진입
2. 직원 화면과 같은 구조, 작성·수정·삭제 UI 없음
3. 일정표는 본인 어르신 생일·시설 공휴일·시설 행사 모두 노출

### 시나리오 7 — 앨범 (7차)

1. 보호자 홈에서 앨범 카드 → `/parent/albums`
2. 헤더 부제: "○○○ 어르신이 참여한 활동" (본인 어르신 명시)
3. **본인 어르신이 참여한 활동만 자동 필터링** — 서버에서 권한 격리
4. 박현우(박정호 가족)는 "실버 체조 시간" 활동 안 보임 — 박정호가 와상이라 체조 미참여
5. 카드 클릭 → 상세에서 사진 + 참여 어르신 이름 (호실은 미노출)

### 보호자가 접근할 수 없는 것 (보안)

권한 검증으로 막혀 있습니다:
- 본인 어르신 외 다른 어르신의 알림장·리포트·문의·앨범 (403)
- 직원 전용 API (보호자 토큰으로 호출 시 403)
- 알림장의 `raw_memo`, AI 생성 메타데이터, 통계 raw 숫자
- 본인이 작성하지 않은 다른 보호자의 문의
- AI 분류 신뢰도 (`confidence`, `classification_status`) — UI 어디에도 노출 안 됨
- "AI 분류", "AI 다듬기" 같은 AI 처리 흔적 텍스트 (UX 패치로 전수 제거)
- 답변자의 `author.id` (이름·직책만 노출, ID는 응답 제외)

---

## 🔧 관리자 — DB에 직접 자료 넣기

운영 콘솔이 없으므로, 빠른 시드/데모 데이터 주입은 **psql 또는 DBeaver 같은 DB 클라이언트로 INSERT 쿼리 직접 실행**으로 진행합니다. 메뉴별 작업 가이드.

> **주의**: 운영 단계에서는 API 호출이 정석입니다. 직접 INSERT는 개발·데모·발표 직전의 빠른 데이터 주입용입니다.

### 공통 준비

```bash
psql $DATABASE_URL
```

비밀번호 해시는 bcrypt:

```python
# scripts/hash_password.py
from passlib.hash import bcrypt
print(bcrypt.hash("test1234"))
```

---

### 📋 메뉴별 작업 가이드

#### 1. 어르신 추가 (resident)

```sql
INSERT INTO resident (facility_id, name, room_number, care_level, birth_date, gender, precautions)
VALUES (1, '신영자', '306호', '2등급', '1942-03-15', 'F',
        '고혈압 약 복용 중, 식사 시 천천히 진행 필요');

-- 직원에게 담당 배정
INSERT INTO assignment (caregiver_id, resident_id)
VALUES (1, currval('resident_id_seq'));
```

#### 2. 직원 추가 (app_user)

```sql
INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang)
VALUES (1, 'newuser@happy.kr', '$2b$12$...해시...', '신입직원', 'CAREGIVER', 'ko');
```

`role` enum: `CAREGIVER` / `SOCIAL_WORKER` / `ADMIN` / `GUARDIAN`. `preferred_lang`: `ko` / `vi` / `zh` / `en`.

#### 3. 보호자 추가 + 어르신 연결 (app_user + guardian)

```sql
-- 보호자 계정
INSERT INTO app_user (facility_id, email, password_hash, name, role)
VALUES (1, 'newparent@family.kr', '$2b$12$...해시...', '신부모', 'GUARDIAN');

-- 어르신과 연결
INSERT INTO guardian (resident_id, user_id, name, relationship, phone)
VALUES (1, currval('app_user_id_seq'), '신부모', '자녀', '010-0000-0000');
```

한 보호자가 여러 어르신을 갖게 하려면 guardian에 행 2개 이상 INSERT (같은 `user_id`, 다른 `resident_id`).

#### 4. 공지사항 추가 (notice_board)

```sql
INSERT INTO notice_board (facility_id, author_id, title, content)
VALUES (1, 2, '2026년 7월 정기 점검 안내',
        '7월 첫째 주 시설 정기 점검이 있습니다. 일정에 참고 바랍니다.');
```

#### 5. 식단 사진 + 식단 기록 (meal_log)

**Step 1 — 사진을 폴더에 직접 두기**:
```bash
mkdir -p backend/uploads/meals/2026/05
cp my-photos/lunch1.jpg backend/uploads/meals/2026/05/abc123.jpg
```

**Step 2 — meal_log INSERT**:
```sql
INSERT INTO meal_log (facility_id, author_id, meal_date, meal_type, menu_text, photos)
VALUES (1, 2, '2026-05-26', 'LUNCH',
        '잡곡밥
미역국
고등어구이',
        '[{"url":"/static/meals/2026/05/abc123.jpg","uploadedAt":"2026-05-26T12:00:00Z"}]'::jsonb);
```

같은 날·같은 식사구분 중복은 UNIQUE 제약으로 거부. `meal_type` enum: `BREAKFAST` / `LUNCH` / `DINNER` / `SNACK`.

#### 6. 일정 추가 (schedule_event)

```sql
-- 시설 행사
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, description)
VALUES (1, 2, '2026-06-15', 'FACILITY_EVENT', '하지 행사',
        '시원한 식혜와 함께하는 여름 맞이 프로그램');

-- 어르신 생일 (resident_id 필수)
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, resident_id)
VALUES (1, 3, '2026-08-14', 'BIRTHDAY', '신영자 어르신 생신', 9);

-- 공휴일 (author_id NULL OK)
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title)
VALUES (1, NULL, '2026-05-05', 'HOLIDAY', '어린이날');
```

`event_type` enum: `FACILITY_EVENT` / `BIRTHDAY` / `HOLIDAY`.

#### 7. 앨범 추가 (album + album_resident) — 7차

**Step 1 — 사진 폴더**:
```bash
mkdir -p backend/uploads/albums/2026/05
cp event-photos/*.jpg backend/uploads/albums/2026/05/
```

**Step 2 — album INSERT (트랜잭션 권장)**:
```sql
BEGIN;

INSERT INTO album (facility_id, author_id, activity_date, title, description, photos)
VALUES (1, 2, '2026-05-08', '어버이날 행사',
        '가족분들과 함께하는 따뜻한 시간이었습니다.',
        '[{"url":"/static/albums/2026/05/photo1.jpg","uploadedAt":"2026-05-08T14:00:00Z"},
          {"url":"/static/albums/2026/05/photo2.jpg","uploadedAt":"2026-05-08T14:01:00Z"}]'::jsonb);

-- 참여 어르신 매핑 (활동 ID는 위 INSERT의 id를 사용)
INSERT INTO album_resident (album_id, resident_id) VALUES
  ((SELECT id FROM album WHERE title='어버이날 행사'), 1),
  ((SELECT id FROM album WHERE title='어버이날 행사'), 2),
  ((SELECT id FROM album WHERE title='어버이날 행사'), 3);

COMMIT;
```

활동당 사진 최대 10장, 참여 어르신 최소 1명. 박정호(와상)는 활동 어울리는 것만 매핑 — 산책·체조 같은 활동에는 제외하는 게 데이터 정합성.

#### 8. 보호자 문의 시드 (inquiry) — AI 분류 우회

API로 등록하면 AI가 자동 분류하지만, 시연용으로 분류 상태 강제 설정 시:

```sql
-- 정상 분류 (SUCCESS)
INSERT INTO inquiry (guardian_user_id, resident_id, facility_id, content,
                     category, confidence, classification_scores, classification_status, status)
VALUES (10, 1, 1,
        '어머니 요즘 잠을 잘 못 주무신다고 들었습니다.',
        'HEALTH', 0.88,
        '{"HEALTH":0.88,"ADMIN_AFFAIRS":0.04,"VISIT":0.03,"MEAL":0.03,"OTHER":0.02}'::jsonb,
        'SUCCESS', 'UNREAD');

-- 임계치 미달 → 기타 (시연 가치)
INSERT INTO inquiry (guardian_user_id, resident_id, facility_id, content,
                     category, confidence, classification_scores, classification_status, status)
VALUES (10, 1, 1,
        '안녕하세요',
        'OTHER', 0.42,
        '{"HEALTH":0.18,"ADMIN_AFFAIRS":0.15,"VISIT":0.20,"MEAL":0.05,"OTHER":0.42}'::jsonb,
        'THRESHOLD_FALLBACK', 'UNREAD');
```

#### 9. 문의 답변 시드 (inquiry_answer) — 8차 신규

답변을 박으면서 상태도 ANSWERED로 함께 갱신해야 정합성 유지. **반드시 트랜잭션**.

```sql
BEGIN;

-- 답변 INSERT
INSERT INTO inquiry_answer (inquiry_id, author_id, content)
VALUES (
  3,  -- inquiry id
  2,  -- 박서준 사회복지사
  '안녕하세요 보호자님. 토요일 오후 2시 방문 가능하십니다. 면회실에서 30분 정도 시간을 마련해 두겠습니다. 따뜻한 옷차림으로 오시면 정원에서도 함께 시간 보내실 수 있습니다.'
);

-- inquiry 상태를 ANSWERED로 변경
UPDATE inquiry SET status = 'ANSWERED' WHERE id = 3;

COMMIT;
```

UNREAD 상태의 문의에 직접 답변 INSERT는 워크플로우에 맞지 않으므로, 답변 시드는 항상 READ → ANSWERED 전이로 만드세요.

#### 10. 프로그램 (오늘의 공통 활동) 추가

```sql
INSERT INTO program (facility_id, program_date, start_time, title, description)
VALUES (1, CURRENT_DATE, '14:00', '실버 체조',
        '강당에서 진행되는 가벼운 스트레칭 프로그램');
```

알림장 작성의 S1 공통 프로그램 체크박스에 자동 노출.

#### 11. 시드 데이터 일괄 초기화

⚠️ 운영 중인 DB에서는 금지. 데모 직전 깔끔한 초기화에만:

```bash
psql $DATABASE_URL < init_db.sql
```

---

### 📁 폴더 구조 — 어느 폴더가 무엇을 담는가

```
backend/
├── app/
│   ├── main.py                    # FastAPI 진입점, CORS, 정적 마운트
│   ├── core/
│   │   ├── config.py              # .env 로딩
│   │   └── deps.py                # require_guardian, require_staff, require_content_editor
│   ├── models/                    # SQLAlchemy 모델
│   ├── schemas/                   # Pydantic 스키마
│   ├── routers/                   # API 엔드포인트
│   │   ├── auth.py
│   │   ├── notices.py             # 1·2차 알림장
│   │   ├── reports.py             # 3차 주간 리포트
│   │   ├── residents.py           # 4차 어르신 편집
│   │   ├── board.py               # 4차 공지사항
│   │   ├── parent.py              # 5차 보호자 라우터 (+ 6·7·8차에 식단·일정·앨범·답변 영역 추가)
│   │   ├── inquiries.py           # 5차 문의 + 8차 답변 CRUD
│   │   ├── meals.py               # 6차 식단
│   │   ├── schedule.py            # 6차 일정
│   │   ├── albums.py              # 7차 앨범
│   │   └── uploads.py             # 6·7차 사진 업로드
│   └── services/
│       ├── gemini_service.py      # AI 호출 (1·2차)
│       ├── report_service.py      # 3차 주간 리포트 생성
│       ├── classification_service.py  # 5차 분류
│       └── file_service.py        # 6·7차 파일 업로드·검증 (재사용)
├── alembic/                       # DB 마이그레이션
├── uploads/                       # 사용자 업로드 사진 (.gitignore 처리)
│   ├── meals/
│   │   └── 2026/05/abc123.jpg
│   └── albums/
│       └── 2026/05/def456.jpg
├── static/                        # 시드 샘플 사진 (git 포함)
│   ├── meals/sample/
│   └── albums/sample/
├── init_db.sql                    # 1차 시드
├── .env
└── pyproject.toml

frontend/
├── src/
│   ├── pages/
│   │   ├── Login.tsx              # 직원 로그인 (+ 전환 링크)
│   │   ├── LoginParent.tsx        # 보호자 로그인 (+ 전환 링크)
│   │   ├── Home.tsx               # 직원 홈 (4차)
│   │   ├── Dashboard.tsx          # 1·2차 알림장
│   │   ├── Reports.tsx            # 3차 주간 리포트
│   │   ├── Residents.tsx          # 4차 어르신
│   │   ├── Board/                 # 4차 공지사항
│   │   ├── Inquiries/             # 5차 문의 + 8차 답변 영역
│   │   ├── Meals.tsx              # 6차 식단
│   │   ├── Schedule.tsx           # 6차 일정
│   │   ├── Albums.tsx             # 7차 앨범 목록
│   │   ├── AlbumDetail.tsx        # 7차 앨범 상세
│   │   └── parent/
│   │       ├── Home.tsx
│   │       ├── Notices.tsx        # 5차 + UX 패치(상태값 카드)
│   │       ├── Reports.tsx        # 5차 + UX 패치(한 줄 요약)
│   │       ├── Board.tsx
│   │       ├── Inquiries.tsx      # 5차 + 8차 답변 영역
│   │       ├── Meals.tsx
│   │       ├── Schedule.tsx
│   │       ├── Albums.tsx         # 7차
│   │       └── AlbumDetail.tsx
│   ├── components/
│   │   ├── Modal.tsx              # 6차 공용 모달 (식단·일정·앨범 재사용)
│   │   ├── MealModal.tsx
│   │   ├── ScheduleModal.tsx
│   │   ├── AlbumModal.tsx
│   │   ├── StatusDisplay.tsx      # UX 패치 — 보호자 상태값 카드
│   │   ├── InquiryAnswerForm.tsx  # 8차 답변 작성 폼
│   │   └── InquiryAnswerDisplay.tsx  # 8차 답변 표시 + inline edit
│   ├── api/                       # 컴포넌트는 항상 이 레이어 경유
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── notices.ts
│   │   ├── reports.ts
│   │   ├── board.ts
│   │   ├── parent.ts
│   │   ├── inquiries.ts           # 5차 + 8차 답변 endpoint
│   │   ├── meals.ts
│   │   ├── schedule.ts
│   │   ├── albums.ts
│   │   └── uploads.ts
│   ├── store/                     # Zustand
│   ├── types/
│   └── App.tsx                    # 라우팅
└── package.json
```

---

## ⚠️ AI 안전성 — precautions 시연

발표·심사용 핵심 시연 시나리오입니다. 두 어르신이 시금석:

| 어르신 | 특징 | 시연 가치 |
|---|---|---|
| 박정호 (id=3) | 와상, 휠체어, 위루관 | AI가 "걸으셨다 / 산책" 거짓 활동 서술 금지 + 활동 이모지(🚶 🏃) 금지 + 활동 앨범에서 참여자 자동 제외 |
| 김순자 (id=1) | 일반, 3등급 | 정상 동작 비교용 |

박정호로 시도해 결과 본문을 꼭 확인하세요:
- 1차 알림장 생성 → "걸으셨다" 류 없음
- 3차 주간 리포트 → 활동 거짓 서술 없음
- 7차 앨범 → 박현우(박정호 가족)로 로그인 시 "실버 체조 시간" 활동 자동 숨김
- UX 패치 이모지 → 본문에 🚶 같은 활동 이모지 없음

precautions 시스템이 1차→3차→UX 패치 이모지→7차 앨범 권한 격리까지 4가지 방향으로 작동하는 모습이 이 서비스의 핵심 신뢰 포인트.

---

## 📚 문서

- `개발_핸드오프_문서_v3.md` — 1차 MVP 설계 (가장 중요한 기반)
- `init_db.sql` — 1차 DB 시드
- `작업지시문_Prompt_Playbook.md` — 1차 코딩 단계별 지시문
- `2차스프린트_다국어_핸드오프.md`
- `3차스프린트_주간리포트_핸드오프.md`
- `4차스프린트_홈_어르신_공지_핸드오프.md`
- `5차스프린트_보호자채널_AI분류_핸드오프.md`
- `6차스프린트_식단표_일정표_핸드오프.md`
- `7차스프린트_앨범_핸드오프.md`
- `8차스프린트_문의답변_핸드오프.md` ⭐ 신규
- `UX_미세조정_패치_v1.md`
- `로그인전환링크_패치_v1.md`

---

## 향후 로드맵

| 스프린트 | 기능 | 상태 |
|---|---|---|
| 1~8차 | 알림장·다국어·리포트·홈·보호자·식단·일정·앨범·답변 | ✅ 설계 완료 |
| UX 패치·로그인 전환 | 사용자 경험 다듬기 | ✅ 설계 완료 |
| 9차 (예정) | **AI 답변 초안 자동 생성** — 시설 규칙·precautions 참고하여 답변 초안 제안, 직원 검수 후 전송 | 🔜 다음 |
| 10차 이상 | 운영 통계 대시보드, 어르신 생일 자동 추출, 보호자 푸시·이메일 알림, 본인 확인 인증, 사진 라이트박스, S3 스토리지 전환 | 🔮 검토 |

---

## 라이선스

(프로젝트 상황에 맞게 추가)

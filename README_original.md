# 케어알림장 (CareAlimjang)

요양원·주야간보호센터의 요양보호사가 짧은 메모 몇 줄로 보호자에게 보낼 따뜻한 알림장을 만들고, 한 주의 흐름을 종합 편지로 정리하며, 보호자 문의를 AI가 자동 분류해 적절한 담당자에게 전달하는 케어 커뮤니케이션 서비스입니다.

> **상태**: 1~6차 스프린트 설계 완료. 실제 구현은 핸드오프 문서를 기준으로 진행됩니다.

---

## 핵심 가치

직원이 "점심 미역국 절반 / 컨디션 좋음" 같은 짧은 메모와 정형 상태 칩(건강·기분·식사·투약)만 입력하면, AI(Gemini)가 어르신의 기저질환을 반영해 보호자에게 보낼 따뜻한 알림장 3안을 생성합니다. 직원은 그중 한 안을 골라 다듬어 전송합니다. AI는 어르신의 `precautions`(예: "와상 환자, 휠체어 사용 필수")를 시스템 프롬프트로 주입받아 **있을 수 없는 활동을 지어내지 않습니다** — 와상 환자에게 "산책 다녀오셨다" 같은 거짓 서술이 나오지 않습니다.

---

## 기능 한눈에 (1~6차 누적)

| 스프린트 | 기능 | 사용자 |
|---|---|---|
| 1차 | 일간 알림장 작성·전송 (AI 3안 + 톤 + 다듬기 + 4대 방어 로직) | 직원 |
| 2차 | 다국어 메모 입력 (외국어 → 한국어 자동 변환) | 외국인 직원 |
| 3차 | 주간 안심 리포트 (한 주 데이터를 AI가 종합 편지로) | 직원 → 보호자 |
| 4차 | 홈 그리드 + 어르신 특이사항 관리 + 공지사항 | 직원 |
| 5차 | 보호자 채널 (로그인·조회·문의) + AI 문의 5분류 | 보호자·직원 |
| 6차 | 식단표(하루 단위 사진+텍스트) + 일정표(공휴일·생일·행사) | 직원·보호자 |

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

# 사진 업로드 (6차)
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

# 시드 적용
psql $DATABASE_URL < init_db.sql
```

### 3) 백엔드 실행

```bash
cd backend
uv sync   # 또는 pip install -r requirements.txt

# 마이그레이션 (Alembic 사용 시)
alembic upgrade head

# 서버 기동
uvicorn app.main:app --reload --port 8000
```

`http://localhost:8000/docs`에서 Swagger 자동 문서 확인 가능.

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
| 사회복지사 | seojun@happy.kr | test1234 | 박서준, 식단·일정·공지 작성 권한 |
| 관리자 | admin@happy.kr | test1234 | 모든 권한 |
| 외국인 직원 | huong@happy.kr | test1234 | 후엉, 베트남어 기본 (2차) |
| 보호자 | boram@family.kr | test1234 | 김보람, 김순자 어르신 가족 (5차) |
| 보호자 | jiwon@family.kr | test1234 | 이지원, 이복남 어르신 가족 |
| 보호자 | hyeonu@family.kr | test1234 | 박현우, 박정호 어르신 가족 |

직원은 `/login`, 보호자는 `/login-parent`로 로그인합니다.

---

## 🏥 요양보호사 입장 — 서비스 이용 방법

직원으로 로그인하면 8개 카드의 홈 그리드를 만나게 됩니다. 카드별 동선과 테스트 시나리오를 정리했습니다.

### 시나리오 1 — 일간 알림장 작성 (가장 핵심)

**테스트 계정**: `minji@happy.kr / test1234` 권장. 단, 박정호(와상) 어르신을 담당하는 계정이어야 와상 시연 가능.

1. `/login`에서 로그인 → `/home` 진입
2. **알림장 카드** 클릭 → `/dashboard` 이동
3. 화면에 보이는 영역:
   - **S1**: 오늘 공통 프로그램 (체크박스, 기본 전체 체크)
   - **S2**: 담당 어르신 카드 그리드 (미작성 우선 정렬, 진행률 표시)
4. **박정호 어르신 카드 클릭** (와상 환자, AI 안전성 시연용)
5. **S3 작성 영역** 채우기:
   - 공통 프로그램: 그대로 체크 또는 일부 해제
   - 상태 칩: 건강·기분·식사 (필수, 라디오), 투약 (선택)
   - 특이사항 메모: 한국어 또는 외국어 입력 가능 (2차 기능). 음성 입력 버튼 지원
   - 톤: 친근 / 정중(기본) / 공감·위로
6. **[AI로 알림장 생성]** 클릭 → 3~5초 후 3안이 나옵니다
7. **S4 결과 영역**: A/B/C 탭 중 마음에 드는 안 선택 후 본문 직접 수정 가능
8. **[맞춤법·표현 다듬기]** (1회만 사용 가능) — AI가 한 번 더 문장을 다듬음
9. **[전송하기]** 클릭 → 토스트 "전송 완료" + S2 카드가 ✅로 갱신

**확인 포인트** — 박정호 어르신(와상)으로 생성 시 결과 본문에 "걸으셨다 / 산책 다녀오셨다" 같은 거짓 서술이 **나오지 않아야** 합니다. AI가 precautions를 읽고 가능한 활동만 서술합니다.

### 시나리오 2 — 외국어 메모로 알림장 작성 (2차)

**테스트 계정**: `huong@happy.kr / test1234` (베트남 직원, 기본 언어 vi)

1. 후엉으로 로그인 → 알림장 화면 진입
2. 담당 어르신 선택 → S3 메모 영역의 **언어 칩**이 자동으로 🇻🇳 베트남어 선택됨
3. 메모 textarea의 placeholder가 베트남어 예시로 변경됨
4. 베트남어로 메모 입력 (예: "Ăn hết nửa bát canh, tâm trạng vui vẻ")
5. **[AI로 알림장 생성]** → 결과는 **한국어**로 나옴
6. 검수 후 전송

언어 칩을 다른 언어로 바꾸면 그 즉시 후엉의 `preferred_lang`이 저장되어, 다음 로그인 시 자동 반영됩니다.

### 시나리오 3 — 작성한 알림장 수정·재전송

1. S2 어르신 카드가 ✅(작성완료) 상태일 때 카드를 다시 클릭
2. 과거 알림장이 읽기 전용으로 표시됨
3. **[수정하여 재전송하기]** 클릭 → 작성 모드로 전환 (상태값·메모 복원)
4. 수정 후 전송하면 새 행이 version+1로 INSERT됨 (append-only, 이력 보존)

### 시나리오 4 — 주간 안심 리포트 (3차)

1. 홈 그리드의 **주간 리포트** 카드 클릭 → `/reports`
2. 담당 어르신 선택, 주 선택 (기본 = 지난주)
3. **[리포트 생성]** 클릭
4. 서버가 해당 주 데이터를 집계하고 분기:
   - **기록 0일**: 차단 안내 ("리포트를 만들 수 없습니다")
   - **1~2일**: confirm 모달 "제한된 정보로 작성됩니다. 계속할까요?"
   - **3일 이상**: 정상 생성
5. R2(통계 요약, 코드 집계)가 즉시 표시되고, R3(AI 편지)는 잠시 로딩 후 표시
6. 편지 본문 직접 편집 가능. **[다시 생성]** 1회 사용 가능
7. **[전송하기]** → report 테이블에 INSERT + 보호자에게 도달

**확인 포인트** — 박정호(와상) 어르신으로 리포트 생성 시에도 "산책 다녀오셨다" 류 거짓 서술 없음 (precautions 주입은 알림장과 동일하게 작동).

### 시나리오 5 — 어르신 특이사항 편집 (4차)

1. 홈 그리드의 **어르신** 카드 클릭 → `/residents`
2. 좌측 담당 어르신 목록에서 박정호 선택
3. 우측에 기본 정보(읽기 전용) + precautions 편집 영역(textarea)
4. precautions에 한 줄 추가 (예: "당뇨 진단 추가, 단 음식 제한")
5. **[수정 사항 저장]** → 토스트 "다음 알림장 생성부터 반영됩니다"
6. 알림장 카드로 돌아가 박정호로 알림장 생성 → 결과에 새 주의사항이 반영되는지 확인

**핵심 가치**: AI 안전장치를 직원이 직접 제어 가능. 어르신 상태 변화 시 즉시 반영.

### 시나리오 6 — 공지사항 (4차)

1. 홈 그리드의 **공지사항** 카드 클릭 → `/board`
2. 카드 리스트(최신순) + 우상단 **[+ 새 공지 작성]**
3. 작성 페이지: 제목 + 본문 + [저장]
4. 작성한 글에는 [수정][삭제] 아이콘이 보임 (본인 글만)
5. 다른 사람 글에는 아이콘 없음 (관리자 계정으로 보면 모든 글에 아이콘)

### 시나리오 7 — 보호자 문의 처리 (5차)

1. 홈 그리드의 **보호자 문의** 카드 클릭 → `/inquiries`
2. 상단 카테고리 필터 [전체][건강][행정][면회][식단][기타]
3. 좌측 [미확인만 보기] 토글
4. 문의 카드 클릭 → 상세
5. 상세 화면에 어르신 정보 + **precautions가 함께 표시** (직원이 맥락 즉시 파악)
6. **[확인 완료로 표시]** 클릭 → 상태 갱신
7. (5차 범위 밖) 실제 답변은 외부 채널(전화·카톡 등)로

**확인 포인트** — 시드 문의 3건이 각각 다른 분류 상태(SUCCESS / THRESHOLD_FALLBACK / READ)로 들어 있어 시연 가치 있음. 신뢰도 숫자는 직원 화면에도 보이지 않습니다(정책).

### 시나리오 8 — 식단표 등록 (6차)

**테스트 계정**: `seojun@happy.kr / test1234` (사회복지사, 식단·일정 작성 권한). 김민지(CAREGIVER)로는 등록 버튼이 보이지 않습니다.

1. 홈 그리드의 **식단표** 카드 클릭 → `/meals`
2. 날짜 네비로 오늘 또는 며칠 전으로 이동 (←/→ 화살표, 또는 키보드 화살표 키)
3. **미래 날짜로는 이동 불가** (오늘 이후 [▶] 비활성)
4. 4행 세로 (아침/점심/저녁/간식) 중 빈 행 클릭 → "🌅 아침 식단 등록하기"
5. 모달:
   - 날짜·식사구분 자동 채움
   - 사진 1~2장 업로드 (1장당 5MB, jpg/jpeg/png/webp)
   - 메뉴 텍스트 줄단위 입력 ("수수밥\n미역국\n고등어구이")
6. **[저장]** → 행에 사진+메뉴 표시

### 시나리오 9 — 일정표 등록 (6차)

1. 홈 그리드의 **일정표** 카드 클릭 → `/schedule`
2. 월 네비 [◀] 2026년 5월 [▶]
3. 공휴일은 시드로 이미 등록되어 있음 (어린이날 빨간색 + 🚩)
4. **[+ 일정 등록]** → 모달
5. 유형 선택:
   - **시설 행사**: 제목·설명 입력
   - **어르신 생일**: 어르신 드롭다운 자동 노출, 어르신 선택
   - **공휴일**: 시드로 충분, 굳이 추가 등록 안 해도 됨
6. **[저장]**

---

## 👪 보호자 입장 — 서비스 이용 방법

보호자는 직원과 별도 경로로 로그인합니다.

**테스트 계정**: `boram@family.kr / test1234` (김보람, 김순자 어르신 가족)

### 시나리오 1 — 로그인 및 홈

1. `/login-parent`로 접속 (직원 로그인과 화면 분리)
2. 이메일·비밀번호 입력
3. `/parent/home`으로 이동 — 따뜻한 미색 배경
4. 상단 어르신 카드: "김순자 어르신의 가족 김보람님" + 호실·나이·등급
5. 4개 카드: **공지사항 → 받은 알림장 → 주간 리포트 → 문의하기**
6. 각 카드에 미확인 카운트 + 빨간 점

### 시나리오 2 — 받은 알림장 조회

1. **받은 알림장** 카드 클릭 → `/parent/notices`
2. 알림장 목록 (최신순). 미확인 알림장에 빨간 점
3. 카드 클릭 → 상세 (`/parent/notices/{id}`)
4. 직원이 다듬어 보낸 한국어 본문만 표시 (raw_memo, AI 메타데이터는 보이지 않음)
5. 상세 진입 즉시 `read_at`이 갱신되어, 목록으로 돌아오면 빨간 점이 사라짐

### 시나리오 3 — 주간 리포트 조회

1. **주간 리포트** 카드 → `/parent/reports`
2. 주차별 카드 (5월 4주차, 5월 3주차…)
3. 상세에 AI가 쓴 종합 편지만 표시 (통계 raw 숫자는 보이지 않음 — 편지 본문에 자연스럽게 녹아 있음)
4. 진입 시 `read_at` 자동 갱신

### 시나리오 4 — 공지사항 조회

1. **공지사항** 카드 → `/parent/board`
2. 카드 리스트 (최신순). 보호자는 읽기 전용 — [수정][삭제] 버튼 없음
3. 카드 클릭 → 상세

### 시나리오 5 — 문의 작성 (AI 자동 분류 핵심)

1. **문의하기** 카드 → `/parent/inquiries`
2. **[+ 새 문의 작성]** 클릭 → `/parent/inquiries/new`
3. 제목(선택) + 본문(필수) 입력
   - 예시 입력: "어머니 요즘 식사를 잘 못 드시는 것 같은데 건강 괜찮으신지 궁금합니다."
4. **카테고리 선택 UI 없음** — AI가 자동 분류
5. **[전송]** 클릭 → 3~5초 대기 후 토스트 "문의가 등록되었습니다"
6. 목록으로 돌아오면 본인 문의가 카테고리 뱃지("건강")와 함께 표시됨
7. 직원이 확인하면 상태가 "확인 대기" → "확인 완료"로 변경됨

**확인 포인트** — "안녕하세요, 잘 지내시죠?" 같은 짧고 모호한 문의는 임계치 미달로 **기타**로 분류됩니다. 신뢰도 숫자는 보호자 화면에 표시되지 않습니다.

### 시나리오 6 — 식단표 / 일정표 (6차)

1. 보호자 홈에 식단표·일정표 카드 노출 (6차에 활성화)
2. **식단표** 클릭 → `/parent/meals` — 직원 화면과 같은 하루 단위 4행 구조, 단 작성·수정·삭제 UI 없음
3. **일정표** 클릭 → `/parent/schedule` — 월별 목록, 공휴일·생일·시설행사 모두 조회

### 보호자가 접근할 수 없는 것

권한 검증으로 막혀 있습니다(보안):
- 본인 어르신 외 다른 어르신의 알림장·리포트·문의 (403)
- 직원 전용 API (`/api/residents/assigned` 등은 보호자 토큰으로 403)
- 알림장의 raw_memo, AI 생성 메타데이터, 통계 raw 숫자, 작성자 정보
- 본인이 작성하지 않은 다른 보호자의 문의

---

## 🔧 관리자 — DB에 직접 자료 넣기

운영 콘솔이 없으므로, 빠른 시드/데모 데이터 주입은 **psql 또는 DBeaver 같은 DB 클라이언트로 INSERT 쿼리 직접 실행**으로 진행합니다. 메뉴별로 어느 테이블을 만지면 되는지 정리했습니다.

> **주의**: 운영 단계에서는 API 호출이 정석입니다. 직접 INSERT는 개발·데모·발표 직전의 빠른 데이터 주입용입니다. 트리거나 정합성 검증을 우회할 수 있어 신중히.

### 공통 준비

```bash
# psql 접속
psql $DATABASE_URL

# 또는 DBeaver/TablePlus 같은 GUI 클라이언트로 연결
```

비밀번호 해시는 bcrypt로 생성해야 합니다. 간단 스크립트:

```python
# scripts/hash_password.py
from passlib.hash import bcrypt
print(bcrypt.hash("test1234"))
# 출력: $2b$12$... 이걸 password_hash 컬럼에 INSERT
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
VALUES (1, currval('resident_id_seq'));  -- 김민지(id=1)에게 배정
```

#### 2. 직원 추가 (app_user)

```sql
-- 비밀번호 해시 먼저 생성 (위 파이썬 스크립트)
INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang)
VALUES (1, 'newuser@happy.kr', '$2b$12$...해시...', '신입직원', 'CAREGIVER', 'ko');
```

`role`은 enum: `CAREGIVER` / `SOCIAL_WORKER` / `ADMIN` / `GUARDIAN`. `preferred_lang`은 `ko` / `vi` / `zh` / `en`.

#### 3. 보호자 추가 + 어르신 연결 (app_user + guardian)

```sql
-- 보호자 계정
INSERT INTO app_user (facility_id, email, password_hash, name, role)
VALUES (1, 'newparent@family.kr', '$2b$12$...해시...', '신부모', 'GUARDIAN');

-- 어르신과 연결 (guardian 테이블)
INSERT INTO guardian (resident_id, user_id, name, relationship, phone)
VALUES (1, currval('app_user_id_seq'), '신부모', '자녀', '010-0000-0000');
```

**한 보호자가 여러 어르신**을 갖게 하려면 `guardian` 테이블에 행 2개 이상 INSERT (같은 `user_id`, 다른 `resident_id`).

#### 4. 공지사항 추가 (notice_board)

```sql
INSERT INTO notice_board (facility_id, author_id, title, content)
VALUES (1, 2,  -- author_id=2는 박서준
        '2026년 7월 정기 점검 안내',
        '7월 첫째 주 시설 정기 점검이 있습니다. 일정에 참고 바랍니다.');
```

#### 5. 식단 사진 + 식단 기록 (meal_log) — 폴더 작업 포함

식단 사진은 파일 업로드 인프라가 따로 있어서, 두 단계로 작업합니다.

**Step 1 — 사진을 폴더에 직접 두기**

```bash
# 백엔드 루트의 uploads/meals/YYYY/MM/ 폴더에 사진 복사
mkdir -p backend/uploads/meals/2026/05
cp my-photos/lunch1.jpg backend/uploads/meals/2026/05/abc123.jpg
```

파일명은 UUID 형식 권장 (`abc123.jpg`). 그냥 `lunch1.jpg`로 둬도 동작은 하지만, API로 업로드한 사진과 일관성이 떨어집니다.

**Step 2 — meal_log에 INSERT**

```sql
INSERT INTO meal_log (facility_id, author_id, meal_date, meal_type, menu_text, photos)
VALUES (1, 2, '2026-05-26', 'LUNCH',
        '잡곡밥
미역국
고등어구이
시금치나물
배추김치',
        '[{"url":"/static/meals/2026/05/abc123.jpg","uploadedAt":"2026-05-26T12:00:00Z"}]'::jsonb);
```

**핵심 포인트**:
- `photos` JSONB의 `url`이 실제 파일 위치(`uploads/meals/2026/05/abc123.jpg`)와 매핑되어야 함
- 같은 날·같은 식사구분 중복 시 UNIQUE 제약으로 거부됨
- `meal_type` enum: `BREAKFAST` / `LUNCH` / `DINNER` / `SNACK`

**여러 식단 일괄 등록 패턴**:

```sql
INSERT INTO meal_log (facility_id, author_id, meal_date, meal_type, menu_text, photos) VALUES
(1, 2, CURRENT_DATE, 'BREAKFAST', '호박죽\n두부조림', '[{"url":"/static/meals/sample/breakfast.jpg","uploadedAt":"now"}]'),
(1, 2, CURRENT_DATE, 'LUNCH',     '잡곡밥\n미역국',   '[{"url":"/static/meals/sample/lunch.jpg","uploadedAt":"now"}]'),
(1, 2, CURRENT_DATE, 'DINNER',    '흑미밥\n닭갈비',   '[]'),
(1, 2, CURRENT_DATE, 'SNACK',     '단호박죽',         '[{"url":"/static/meals/sample/snack.jpg","uploadedAt":"now"}]');
```

#### 6. 일정 추가 (schedule_event)

```sql
-- 시설 행사
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, description)
VALUES (1, 2, '2026-06-15', 'FACILITY_EVENT', '하지(夏至) 행사',
        '시원한 식혜와 함께하는 여름 맞이 프로그램');

-- 어르신 생일 (resident_id 필수)
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, resident_id)
VALUES (1, 3, '2026-08-14', 'BIRTHDAY', '신영자 어르신 생신', 9);  -- resident_id 9

-- 공휴일 (author_id NULL OK)
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title)
VALUES (1, NULL, '2026-05-05', 'HOLIDAY', '어린이날');
```

**`event_type` enum**: `FACILITY_EVENT` / `BIRTHDAY` / `HOLIDAY`

#### 7. 보호자 문의 시드 추가 (inquiry) — AI 분류 우회

API로 등록하면 AI가 자동 분류하지만, 시연용으로 분류 상태를 강제 설정하고 싶을 때:

```sql
-- 정상 분류 (SUCCESS)
INSERT INTO inquiry (guardian_user_id, resident_id, facility_id, content,
                     category, confidence, classification_scores, classification_status, status)
VALUES (10, 1, 1,
        '어머니 요즘 잠을 잘 못 주무신다고 들었습니다. 어떤 상황인지요?',
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

#### 8. 프로그램 (오늘의 공통 활동) 추가

```sql
INSERT INTO program (facility_id, program_date, start_time, title, description)
VALUES (1, CURRENT_DATE, '14:00', '실버 체조',
        '강당에서 진행되는 가벼운 스트레칭 프로그램');
```

알림장 작성 화면의 S1(공통 프로그램 체크박스)에 자동 노출됩니다.

#### 9. 시드 데이터 일괄 초기화

운영 중인 DB가 아니라면 `init_db.sql`을 다시 실행할 수 있지만 **기존 데이터가 모두 삭제됩니다**:

```bash
# 위험: 모든 데이터 삭제 후 시드만 다시 들어감
psql $DATABASE_URL < init_db.sql
```

데모 직전에 한 번 깔끔하게 초기화하고 싶을 때만 사용. 운영에선 절대 금지.

---

### 📁 폴더 구조 — 어느 폴더가 무엇을 담는가

```
backend/
├── app/
│   ├── main.py                    # FastAPI 진입점, CORS, 정적 마운트
│   ├── core/
│   │   ├── config.py              # .env 로딩
│   │   └── deps.py                # require_guardian, require_staff, require_content_editor
│   ├── models/                    # SQLAlchemy 모델 (resident, notice, report, inquiry, meal_log, ...)
│   ├── schemas/                   # Pydantic 스키마
│   ├── routers/                   # API 엔드포인트
│   │   ├── auth.py
│   │   ├── notices.py             # 1차 알림장 generate/refine/send
│   │   ├── reports.py             # 3차 주간 리포트
│   │   ├── residents.py           # 4차 어르신 편집
│   │   ├── board.py               # 4차 공지사항
│   │   ├── parent.py              # 5차 보호자 라우터
│   │   ├── inquiries.py           # 5차 직원 문의 처리
│   │   ├── meals.py               # 6차 식단
│   │   ├── schedule.py            # 6차 일정
│   │   └── uploads.py             # 6차 사진 업로드
│   └── services/
│       ├── gemini_service.py      # AI 호출 (1·2·3차)
│       ├── classification_service.py  # 5차 분류
│       └── file_service.py        # 6차 파일 업로드·검증
├── alembic/                       # DB 마이그레이션
├── uploads/                       # 사용자 업로드 사진 (.gitignore 처리)
│   └── meals/
│       └── 2026/05/abc123.jpg
├── static/                        # 시드 샘플 사진 (git 포함)
│   └── meals/sample/
├── init_db.sql                    # 1차 시드
├── .env
└── pyproject.toml

frontend/
├── src/
│   ├── pages/
│   │   ├── Login.tsx              # 직원 로그인
│   │   ├── LoginParent.tsx        # 보호자 로그인 (5차)
│   │   ├── Home.tsx               # 직원 홈 (4차)
│   │   ├── Dashboard.tsx          # 1·2차 알림장
│   │   ├── Reports.tsx            # 3차 주간 리포트
│   │   ├── Residents.tsx          # 4차 어르신
│   │   ├── Board/                 # 4차 공지사항 (List/Detail/Form)
│   │   ├── Inquiries/             # 5차 직원 문의
│   │   ├── Meals.tsx              # 6차 식단
│   │   ├── Schedule.tsx           # 6차 일정
│   │   └── parent/
│   │       ├── Home.tsx
│   │       ├── Notices.tsx
│   │       ├── Reports.tsx
│   │       ├── Board.tsx
│   │       ├── Inquiries.tsx
│   │       ├── Meals.tsx
│   │       └── Schedule.tsx
│   ├── components/
│   │   ├── Modal.tsx              # 6차 공용 모달 (식단·일정)
│   │   ├── MealModal.tsx
│   │   └── ScheduleModal.tsx
│   ├── api/                       # 컴포넌트는 항상 이 레이어를 거침 (직접 fetch 금지)
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── notices.ts
│   │   ├── reports.ts
│   │   ├── board.ts
│   │   ├── parent.ts
│   │   ├── inquiries.ts
│   │   ├── meals.ts
│   │   ├── schedule.ts
│   │   └── uploads.ts
│   ├── store/                     # Zustand
│   ├── types/
│   └── App.tsx                    # 라우팅
└── package.json
```

---

## ⚠️ AI 안전성 — precautions 시연

발표·심사용 핵심 시연 시나리오입니다. 두 명의 어르신이 핵심:

| 어르신 | 특징 | 시연 가치 |
|---|---|---|
| 박정호 (id=3) | 와상, 휠체어, 위루관 | AI가 "걸으셨다 / 산책" 같은 거짓 활동 서술 금지 검증 |
| 김순자 (id=1) | 일반, 3등급 | 정상 동작 비교용 |

알림장 생성·주간 리포트 생성에서 박정호로 시도해 결과 본문을 꼭 확인하세요. precautions에 명시된 제약을 AI가 지키는지가 이 서비스의 핵심 신뢰 포인트입니다.

---

## 문서

- `개발_핸드오프_문서_v3.md` — 1차 MVP 설계 (가장 중요한 기반 문서)
- `init_db.sql` — 1차 DB 시드
- `작업지시문_Prompt_Playbook.md` — 1차 코딩 단계별 지시문
- `2차스프린트_다국어_핸드오프.md` — 2차 다국어 델타
- `3차스프린트_주간리포트_핸드오프.md` — 3차 리포트 델타
- `4차스프린트_홈_어르신_공지_핸드오프.md` — 4차 운영 도구 델타
- `5차스프린트_보호자채널_AI분류_핸드오프.md` — 5차 보호자 채널 델타
- `6차스프린트_식단표_일정표_핸드오프.md` — 6차 식단·일정 델타

---

## 향후 로드맵

| 스프린트 | 기능 |
|---|---|
| 7차 (예정) | 앨범 (6차 사진 인프라 재활용한 갤러리) |
| 8차 (검토) | 보호자 문의 답변 작성 UI (AI 답변 초안 자동 생성 포함 검토) |
| 9차 이상 | 운영 통계 대시보드, 어르신 생일 자동 추출, 알림톡 연동, 본인 확인 인증 등 |

---

## 라이선스

(프로젝트 상황에 맞게 추가)

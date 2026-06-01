# 케어알림장 — 5차 스프린트 핸드오프 (보호자 채널 + AI 문의 분류) v1.0

> **이 문서의 성격**: 1차(MVP) · 2차(다국어) · 3차(주간 리포트) · 4차(홈+어르신+공지)가 **이미 구현 완료된 상태**에 얹는 **델타 문서**입니다. 1~4차 산출물을 먼저 읽은 전제로 작성되었습니다.
>
> **5차 스프린트 범위**: 두 축. ① 보호자 채널(ID/비밀번호 로그인, 본인 어르신의 알림장·리포트 조회, 문의 작성) ② 보호자 문의 AI 자동 분류(5개 카테고리 + 임계치 fallback). 보호자 본인 확인 절차는 미수행(시드 계정).
>
> **변경 총량**: 신규 테이블 1개(`inquiry`) + enum 추가 4종 + `guardian.user_id` 컬럼 추가 + 신규 API 13개 + 신규 화면 9개(보호자 8 + 직원 2) + 권한 의존성 2종(require_guardian, require_staff). 기존 1~4차 화면은 건드리지 않음.
>
> **⚠️ 보안 핵심**: 5차의 가장 큰 보안 포인트는 **보호자가 본인 어르신 외 데이터에 접근하지 못하게 막는 것**. 모든 보호자 라우터에서 `guardian.user_id == 토큰 user_id` 매핑을 검증해야 함.

---

## 1단계. 요구사항 (확정)

### 스프린트 한 줄 정의
보호자가 ID·비밀번호로 로그인해 본인 어르신의 알림장·주간 리포트·공지를 조회하고 문의를 작성할 수 있게 한다. 보호자 문의는 AI가 5개 카테고리로 자동 분류해 직원에게 전달한다.

### 두 축

**축 1. 보호자 채널**
- 새 사용자 유형: 보호자(`app_user.role = GUARDIAN`)
- 인증: ID/비밀번호 로그인 (시드 계정, 본인 확인 절차 없음 — 운영 시 추가 필요)
- 보호자 화면: 공지사항·받은 알림장·주간 리포트·문의(작성/조회)
- 직원 화면: 홈의 "보호자 문의" 카드 활성화 + 신규 `/inquiries` 화면

**축 2. AI 자동 분류**
- 카테고리: 건강(HEALTH) / 행정(ADMIN_AFFAIRS) / 면회(VISIT) / 식단(MEAL) / 기타(OTHER)
- 분류 시점: 보호자 문의 전송 즉시 서버에서 동기 처리(3~5초 대기)
- 임계치: 4개 정답 카테고리 모두 신뢰도 < `CLASSIFICATION_THRESHOLD`(.env, 기본 0.6) → "기타"
- LLM 실패 시 fallback: 조용히 "기타" 처리 (직원에게 별도 안내 X), `classification_status`로만 구분

### MVP 범위

**범위 안**
- 보호자 로그인(전용 화면 `/login-parent`)
- 보호자 홈 + 알림장·리포트·공지·문의 조회·작성
- AI 5개 카테고리 분류 + 임계치 fallback + LLM 에러 fallback
- 직원 문의 목록(카테고리/상태 필터) + 상세 + 확인완료 처리

**범위 밖**
- 보호자 본인 확인(이메일/SMS 인증)
- 보호자 회원가입 (시드 계정만)
- 답변 초안 자동 생성 (6차 이후)
- 답변 발송 → 보호자 알림(푸시·이메일)
- 첨부 파일, 댓글, 재문의
- 보호자가 신뢰도 / 분류 점수 확인

### 보안 정책
- **신뢰도(`confidence`)는 UI에 노출 안 함**(보호자·직원 모두). DB에만 저장.
- **보호자 라우터·직원 라우터 분리** + 의존성으로 강제. 토큰 위조해도 다른 역할 API 접근 불가.
- **본인 어르신 외 데이터 접근 차단**. URL 직접 입력 시도도 서버에서 막음.

---

## 2단계. 사용자 흐름 (요약)

```
[보호자]                              [직원]
   │                                    │
   ▼                                    ▼
보호자 로그인 (/login-parent)        직원 로그인 (/login)
   │                                    │
   ▼                                    ▼
/parent/home (4개 카드)              /home (8개 카드)
공지·알림장·리포트·문의                보호자 문의 카드 활성
   │                                    │
   ├ 공지 조회                          ▼
   ├ 알림장 조회 (read_at 갱신)       /inquiries 목록
   │   · final_polished_text만         (카테고리·상태 필터)
   │   · raw_memo·AI 메타 숨김           │
   ├ 리포트 조회 (read_at 갱신)         ▼
   │   · final_text만                  /inquiries/{id} 상세
   │   · stats_summary 숨김             · 본문 + 카테고리
   └ 문의 작성/조회                     · 어르신 precautions 함께 표시
        │                              · [확인 완료로 표시]
        ▼
   [서버] AI 분류 (동기, 1회)
   임계치 0.6 미달 → "기타"
   LLM 실패 → 조용히 "기타"
        │
        ▼
   inquiry INSERT
   (category, confidence, scores, classification_status)
```

### 보호자 홈 카드 4개 (좌→우)
**공지사항 → 받은 알림장 → 주간 리포트 → 문의하기** 순서.

### 권한 정책 핵심
- 보호자 라우터: `require_guardian` (role=GUARDIAN만)
- 직원 라우터: `require_staff` (role≠GUARDIAN만)
- 보호자가 본인 어르신 외 알림장·리포트·문의 ID 직접 호출 시 → 403

---

## 3단계. 화면 명세

### 페이지 구성
```
보호자 (신규 8개)                  직원 (신규 2개 + 기존 수정)
/login-parent                      /login (그대로)
/parent/home                       /home (보호자 문의 카드 활성화)
/parent/board(/{id})               /inquiries
/parent/notices(/{id})             /inquiries/{id}
/parent/reports(/{id})
/parent/inquiries(/{id})
/parent/inquiries/new
```

### 디자인 톤
보호자 화면은 미색 배경(`#FBF7F2`)·따뜻한 톤. 직원 화면 파스텔 톤을 따르되 더 부드럽게. 카드는 4개 한 행(직원 8개 2행과 시각 구분).

### 1. /login-parent
| 요소 | 내용 |
|---|---|
| 서비스명 | "케어알림장 · 가족 로그인" |
| 입력 | 이메일·비밀번호 |
| [로그인] | 성공 시 `/parent/home` |
| 직원 링크 | "직원이신가요?" → `/login` 작게 하단 |
| 회원가입·재설정 | 없음 (시드 계정) |

### 2. /parent/home
| 영역 | 내용 |
|---|---|
| 배경 | 미색(`#FBF7F2`) |
| 헤더 | 로고+서비스명 / 시설명 / 날짜 / 보호자명 드롭다운(로그아웃) |
| 어르신 카드 | 본인 어르신 정보 (이름·호실·나이·등급). 멀티 연결 시 드롭다운 |
| 메뉴 4카드 | **공지사항 → 받은 알림장 → 주간 리포트 → 문의하기** |
| 데이터 | `GET /api/parent/me` 단일 호출 (어르신 + 카운트 한 묶음) |
| 상태 텍스트 | 각 카드에 미확인 수 + 빨간 점 |

### 3. 공지사항 `/parent/board`, `/parent/board/{id}`
4차 `notice_board`를 그대로 보호자에게도 노출. 보호자는 **읽기만**(목록·상세). 작성·수정·삭제 버튼 없음. `audience` 컬럼 없이 전체 공지 공개.

### 4. 받은 알림장 `/parent/notices`, `/parent/notices/{id}`
| 화면 | 표시 | 숨김 |
|---|---|---|
| 목록 | 날짜·본문 첫 줄(preview)·미확인 점 | 작성자·AI 메타 |
| 상세 | `final_polished_text`만, 작성일 | raw_memo, ai_generated_texts, structured_status, participated_programs, author |

**상세 진입 시 `read_at` 자동 갱신** (1차 ERD `read_at` 컬럼 활용). 1·3차에서 만든 데이터의 종착지가 이 화면.

### 5. 주간 리포트 `/parent/reports`, `/parent/reports/{id}`
알림장과 동일 패턴. 상세에 `final_text`만, `stats_summary`는 노출 안 함(3단계 결정: 편지 본문에 녹임). `read_at` 자동 갱신.

### 6. 문의 `/parent/inquiries`, `.../new`, `.../{id}`

**목록**: 본인 문의 카드. 카테고리 뱃지 + 본문 첫 줄 + 작성일 + 상태("확인 대기"/"확인 완료"). **신뢰도 숫자 없음**.

**작성 `/parent/inquiries/new`**:
| 요소 | 내용 |
|---|---|
| 제목 | input (선택, 100자) |
| 본문 | textarea (필수, 500자) |
| [전송] | 빈 본문 비활성. 클릭 즉시 disabled+"전송 중..." (1차 방어 3) |
| 카테고리 선택 | **없음** (AI 자동 분류) |
| 전송 후 | 토스트 "문의가 등록되었습니다" + 목록 복귀 |

**상세**: 본인 작성 내용 + 카테고리 뱃지 + 상태. 답변 영역 없음(5차 범위 밖).

### 7. 직원 홈 변경
4차에서 비활성이었던 "보호자 문의" 카드 활성화. 미확인 N건 + 빨간 점. `GET /api/home/summary` 응답에 `inquiry.unreadCount` 추가 필요.

### 8. 직원 문의 목록 `/inquiries`
| 영역 | 내용 |
|---|---|
| 상단 필터 | 카테고리 칩: [전체][건강][행정][면회][식단][기타] |
| 좌측 필터 | [미확인만 보기] 토글 |
| 카드 | 카테고리 뱃지 + 본문 첫 줄 + 작성자(가족명) + 어르신·호실 + 작성일 + 미확인 점 |
| 신뢰도 표시 | **없음** (모든 사용자에게 비공개) |
| 정렬 | 미확인 먼저, 그 안에서 최신순 |

### 9. 직원 문의 상세 `/inquiries/{id}`
| 영역 | 내용 |
|---|---|
| 카테고리 뱃지 | 큰 글씨 (예: "건강") — 신뢰도 표시 X |
| 작성자 | "김보람 (김순자 어르신 가족) · 010-..." |
| **어르신 컨텍스트** | "김순자 · 301호 · 3등급 · precautions: 당뇨, 경증 인지저하" |
| 본문 | 전체 |
| 상태 | "확인 대기" / "확인 완료 (확인자 · 시각)" |
| [확인 완료로 표시] | UNREAD일 때만. 클릭 → `PATCH /api/inquiries/{id}/read` |
| 답변 영역 | **없음** (5차 범위 밖) |

핵심 가치: **precautions를 함께 표시**해 직원이 문의 맥락을 즉시 파악(예: "어머니 식사" 문의 + "당뇨" precautions 동시 노출).

---

## 4단계. 데이터 모델 (델타)

### 결정: 보호자도 app_user에 통합
별도 테이블 안 만듦. `role` enum에 `GUARDIAN` 추가. 인증 로직 단일화.

### enum 추가
```sql
ALTER TYPE user_role ADD VALUE 'GUARDIAN';
CREATE TYPE inquiry_category AS ENUM ('HEALTH','ADMIN_AFFAIRS','VISIT','MEAL','OTHER');
CREATE TYPE inquiry_status AS ENUM ('UNREAD','READ');
CREATE TYPE classification_status AS ENUM (
    'SUCCESS',                 -- 정상 분류
    'THRESHOLD_FALLBACK',      -- 임계치 미달 → 기타
    'LLM_ERROR_FALLBACK'       -- LLM 실패 → 기타
);
```

### guardian 테이블 변경
```sql
ALTER TABLE guardian ADD COLUMN user_id BIGINT REFERENCES app_user(id);
CREATE INDEX idx_guardian_user ON guardian (user_id) WHERE deleted_at IS NULL;
```
한 보호자(user_id)가 여러 어르신(resident_id)을 가질 수 있는 N:M 구조. nullable로 두어 1차 시드 호환.

### 신규 테이블: inquiry
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | bigint | PK | |
| guardian_user_id | bigint | FK → app_user | 작성 보호자 |
| resident_id | bigint | FK → resident | 어느 어르신에 관한 문의 |
| facility_id | bigint | FK → facility | 시설 격리 |
| title | varchar(100) | NULL | 제목 (선택) |
| content | text | NOT NULL | 본문 |
| category | inquiry_category | NOT NULL | 분류 결과 |
| confidence | float | NULL | 최고 신뢰도 (UI 비공개) |
| classification_scores | jsonb | NOT NULL | 5개 카테고리 전체 점수 (검증 로그) |
| classification_status | classification_status | NOT NULL | SUCCESS / THRESHOLD_FALLBACK / LLM_ERROR_FALLBACK |
| status | inquiry_status | NOT NULL default 'UNREAD' | |
| read_by | bigint | FK → app_user, NULL | 확인한 직원 |
| read_at | timestamptz | NULL | 확인 시각 |
| created_at / updated_at / deleted_at | timestamptz | | soft delete |

### classification_scores JSONB
```json
{
  "HEALTH": 0.85, "ADMIN_AFFAIRS": 0.05,
  "VISIT": 0.04, "MEAL": 0.03, "OTHER": 0.03
}
```
전체 점수 박제 — 1·3차 검증 로그 철학 연장.

### 인덱스
```sql
CREATE INDEX idx_inquiry_facility_status_recent
    ON inquiry (facility_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiry_guardian_recent
    ON inquiry (guardian_user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiry_category ON inquiry (category);
```

### 마이그레이션 DDL 전체
```sql
-- 1) enum 확장
ALTER TYPE user_role ADD VALUE 'GUARDIAN';

-- 2) 신규 enum
CREATE TYPE inquiry_category AS ENUM ('HEALTH','ADMIN_AFFAIRS','VISIT','MEAL','OTHER');
CREATE TYPE inquiry_status AS ENUM ('UNREAD','READ');
CREATE TYPE classification_status AS ENUM ('SUCCESS','THRESHOLD_FALLBACK','LLM_ERROR_FALLBACK');

-- 3) guardian에 user_id 추가
ALTER TABLE guardian ADD COLUMN user_id BIGINT REFERENCES app_user(id);
CREATE INDEX idx_guardian_user ON guardian (user_id) WHERE deleted_at IS NULL;

-- 4) inquiry 테이블
CREATE TABLE inquiry (
    id                     BIGSERIAL PRIMARY KEY,
    guardian_user_id       BIGINT NOT NULL REFERENCES app_user(id),
    resident_id            BIGINT NOT NULL REFERENCES resident(id),
    facility_id            BIGINT NOT NULL REFERENCES facility(id),
    title                  VARCHAR(100),
    content                TEXT NOT NULL,
    category               inquiry_category NOT NULL,
    confidence             FLOAT,
    classification_scores  JSONB NOT NULL,
    classification_status  classification_status NOT NULL,
    status                 inquiry_status NOT NULL DEFAULT 'UNREAD',
    read_by                BIGINT REFERENCES app_user(id),
    read_at                TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ
);
CREATE INDEX idx_inquiry_facility_status_recent
    ON inquiry (facility_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiry_guardian_recent
    ON inquiry (guardian_user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiry_category ON inquiry (category);
```

### 시드 데이터
**보호자 계정 3명 추가** (어르신 1·2·3에 각각 가족):
```sql
INSERT INTO app_user (facility_id, email, password_hash, name, role) VALUES
(1, 'boram@family.kr',  '$2b$12$REPLACE...', '김보람',  'GUARDIAN'),
(1, 'jiwon@family.kr',  '$2b$12$REPLACE...', '이지원',  'GUARDIAN'),
(1, 'hyeonu@family.kr', '$2b$12$REPLACE...', '박현우',  'GUARDIAN');
```
**기존 guardian 행에 user_id 매핑**:
```sql
UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email='boram@family.kr')   WHERE resident_id = 1;
UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email='jiwon@family.kr')   WHERE resident_id = 2;
UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email='hyeonu@family.kr') WHERE resident_id = 3;
```
**문의 시드 3건** (classification_status 분산 — 시연 가치):
- 김보람: "어머니 식사를 잘 못 드시는데..." → `HEALTH`, `SUCCESS`, 0.91, UNREAD
- 이지원: "안녕하세요, 잘 지내시죠?" → `OTHER`, `THRESHOLD_FALLBACK`, 0.42, UNREAD
- 박현우: "이번 주 토요일 오후 2시 방문..." → `VISIT`, `SUCCESS`, 0.88, READ

---

## 5단계. API 명세

### 권한 의존성 (5차 보안 기반)
```python
def require_guardian(user = Depends(current_user)):
    if user.role != 'GUARDIAN': raise HTTPException(403, "FORBIDDEN")
    return user

def require_staff(user = Depends(current_user)):
    if user.role == 'GUARDIAN': raise HTTPException(403, "FORBIDDEN")
    return user
```
**모든 라우터에 둘 중 하나 강제**. 1·2·3·4차 기존 라우터에는 `require_staff` 적용해 보호자 토큰 차단.

### 신규 13개 요약
| # | 메서드 | 경로 | 의존성 | LLM |
|---|---|---|---|---|
| 1 | GET | /api/parent/me | guardian | X |
| 2 | GET | /api/parent/board | guardian | X |
| 3 | GET | /api/parent/board/{id} | guardian | X |
| 4 | GET | /api/parent/notices | guardian | X |
| 5 | GET | /api/parent/notices/{id} | guardian | X (read_at 갱신) |
| 6 | GET | /api/parent/reports | guardian | X |
| 7 | GET | /api/parent/reports/{id} | guardian | X (read_at 갱신) |
| 8 | GET | /api/parent/inquiries | guardian | X |
| 9 | GET | /api/parent/inquiries/{id} | guardian | X |
| 10 | POST | /api/parent/inquiries | guardian | **✓ 분류** |
| 11 | GET | /api/inquiries | staff | X |
| 12 | GET | /api/inquiries/{id} | staff | X |
| 13 | PATCH | /api/inquiries/{id}/read | staff | X |

### 1. GET /api/parent/me
```json
{
  "user": { "id":10, "name":"김보람", "email":"boram@family.kr", "role":"GUARDIAN" },
  "residents": [ { "id":1, "name":"김순자", "age":83, "roomNumber":"301호",
                   "careLevel":"3등급", "relationship":"자녀" } ],
  "summary": { "unreadBoardCount":2, "unreadNoticeCount":2,
               "newReportCount":1, "pendingInquiryCount":1 }
}
```
4차 `/api/home/summary` 패턴 재사용. 카드별 4번 호출 금지.

### 2-3. GET /api/parent/board(/{id})
4차 notice_board 재활용. **응답의 canEdit는 항상 false** (보호자는 작성·수정·삭제 권한 없음).

### 4. GET /api/parent/notices
```json
{
  "total": 12,
  "items": [
    { "id":101, "residentId":1, "residentName":"김순자",
      "preview": "안녕하세요 보호자님...",
      "sentAt":"...", "readAt":null }
  ]
}
```
**서버 권한**: `guardian.user_id == 토큰 user_id`로 매핑된 resident만. notice는 status=SENT + 현재본(MAX version) + deleted_at IS NULL. 직원용 메타(raw_memo, ai_generated_texts, structured_status 등) 응답 제외.

### 5. GET /api/parent/notices/{id}
```json
{
  "notice": { "id":101, "residentName":"김순자",
              "finalText":"...", "sentAt":"...", "readAt":"..." }
}
```
**핵심**: 진입 시 `read_at IS NULL`이면 `read_at = now()` UPDATE. **권한 체크 — guardian → resident → notice JOIN으로 본인 어르신 알림장만 허용**. 그 외 403.

응답 포함 X: rawMemo, aiGeneratedTexts, structuredStatus, participatedPrograms, selectedDraftIndex, isRefined, version, isEdited, author.

### 6-7. GET /api/parent/reports(/{id})
알림장 동일 패턴. 상세에서 `finalText`만, `statsSummary` 노출 X. `read_at` 자동 갱신.

### 8. GET /api/parent/inquiries (본인 문의 목록)
```json
{
  "total": 3,
  "items": [ { "id":5, "category":"HEALTH", "preview":"어머니 요즘...",
               "status":"UNREAD", "createdAt":"..." } ]
}
```
`confidence`·`classification_*` 응답 제외.

### 9. GET /api/parent/inquiries/{id}
본인 작성 + category + status만. 내부 메타 제외. 본인 외 문의 접근 시 403.

### 10. POST /api/parent/inquiries ⭐
**요청**: `{ "residentId":1, "title":"...", "content":"..." }`
**응답 201**: `{ "inquiry": { "id":5, "category":"HEALTH", "status":"UNREAD", "createdAt":"..." } }` (confidence·classification_status 제외)

**서버 로직 (필수 순서)**:
1. residentId가 본인 어르신인지 guardian 매핑 확인. 아니면 403.
2. Pydantic 검증 (content 필수, 500자, title 100자).
3. **Gemini 호출** (Structured Output)
   - 프롬프트: "다음 문의를 5개 카테고리(HEALTH/ADMIN_AFFAIRS/VISIT/MEAL/OTHER)로 분류. 각 신뢰도 0~1로 응답."
   - response_schema로 JSON 강제
4. 임계치 판정 (`CLASSIFICATION_THRESHOLD`, .env, 기본 0.6):
   - 4개 정답 중 최고 ≥ 임계치 → 그 카테고리, `SUCCESS`
   - 모두 < 임계치 → `OTHER`, `THRESHOLD_FALLBACK`
5. **LLM 실패 시**: try/except, `OTHER`, confidence=null, scores={}, `LLM_ERROR_FALLBACK`. 보호자에겐 정상 응답.
6. inquiry INSERT.

LLM 호출 1회. 동기 처리. **분류 실패해도 문의는 반드시 저장**. **502 안 던짐** — fallback으로 흡수.

**에러**: `400 VALIDATION_ERROR` · `401` · `403`(본인 어르신 아님) · `500`

### 11. GET /api/inquiries (직원 목록)
**쿼리**: `?category=HEALTH&status=UNREAD&limit=20&offset=0`
```json
{
  "total": 8,
  "summary": { "unread":5, "byCategory":{"HEALTH":3,"ADMIN_AFFAIRS":1,...} },
  "items": [
    { "id":5, "category":"HEALTH", "preview":"어머니 요즘...",
      "guardianName":"김보람", "residentName":"김순자", "residentRoomNumber":"301호",
      "status":"UNREAD", "createdAt":"..." }
  ]
}
```
`confidence`·`classification_status` 제외. facility_id 토큰 자동 필터. 미확인 우선·최신순.

### 12. GET /api/inquiries/{id}
```json
{
  "inquiry": {
    "id":5, "category":"HEALTH", "title":"...", "content":"...",
    "status":"UNREAD",
    "guardian": { "id":10, "name":"김보람", "phone":"010-..." },
    "resident": { "id":1, "name":"김순자", "roomNumber":"301호",
                  "careLevel":"3등급", "precautions":"당뇨, 경증 인지저하" },
    "createdAt":"...", "readBy":null, "readAt":null
  }
}
```
**핵심**: `resident.precautions`를 응답에 포함 — 직원이 문의 맥락을 즉시 파악. `confidence` 제외.

### 13. PATCH /api/inquiries/{id}/read
요청 본문 없음. `status='READ'`, `read_by=토큰`, `read_at=now()` UPDATE. 이미 READ면 무동작·200 (idempotent).
```json
{ "inquiry": { "id":5, "status":"READ", "readAt":"..." } }
```

### 기존 API 영향
- `POST /api/auth/login`: 변경 없음. 응답 user.role로 프론트 분기.
- 1·2·3·4차 모든 라우터: `require_staff` 의존성 적용 → 보호자 토큰 차단.
- 4차 `GET /api/home/summary`: `inquiry.unreadCount` 추가 (4차 응답에 한 필드 더).

### LLM 호출 통계
- POST /api/parent/inquiries: 문의 1건당 1회 (분류만)
- 그 외 5차 API: 0회

---

## 6단계. 기술 스택
**변경 없음.** FastAPI + Gemini gemini-3.5-flash + PostgreSQL + React/Vite.

추가 환경 변수 1개:
```
CLASSIFICATION_THRESHOLD=0.6
```
.env로 분리해 발표 직전에도 바로 조정 가능.

---

## 부록. 작업 지시문 (AI 코딩 에이전트용 / 델타)

> 1~4차 코드가 동작하는 상태에서 시작. 위에서부터 하나씩, `[확인 포인트]` 통과 후 다음으로.
>
> 5차 안에서도 Vertical Slice: **인증·권한 → DB → 보호자 조회 → 보호자 문의 작성(AI) → 직원 문의 처리**.

### [S5-0] 변경 범위 파악
```
이 프로젝트는 1·2·3·4차가 모두 구현되어 동작 중이다.
첨부한 '5차 스프린트 핸드오프(보호자 채널+AI 문의 분류)' 문서를 읽고 영향 범위 목록만 알려줘.
- DB 변경: user_role enum에 GUARDIAN 추가, 신규 enum 3종, guardian에 user_id 컬럼, 신규 inquiry 테이블
- 신규 백엔드: routers/parent.py, routers/inquiries.py, services/classification_service.py(Gemini 분류), 권한 의존성 require_guardian/require_staff
- 신규 프론트: pages/LoginParent, pages/parent/*, pages/Inquiries/*, api/parent.ts, api/inquiries.ts
- 수정: 1·2·3·4차 모든 기존 라우터에 require_staff 의존성 추가. /api/home/summary 응답에 inquiry.unreadCount 추가. 4차 홈의 "보호자 문의" 카드 활성화.
★ 1·2·3·4차의 기존 화면(/dashboard, /reports, /residents, /board, /home)은 절대 건드리지 마.
아직 코드 수정하지 마. 영향 범위 목록만.
```
`[확인]` "보호자도 별도 테이블 만들겠다"고 하면 잘못 — "app_user 통합, role=GUARDIAN"이라고 바로잡기.

### [S5-1] DB 마이그레이션
```
5차 마이그레이션 적용. 기존 데이터 보존(init_db.sql 재실행 금지).
1. ALTER TYPE user_role ADD VALUE 'GUARDIAN';
2. CREATE TYPE inquiry_category, inquiry_status, classification_status (4단계 DDL)
3. ALTER TABLE guardian ADD COLUMN user_id BIGINT REFERENCES app_user(id);
   부분 인덱스 (user_id) WHERE deleted_at IS NULL
4. CREATE TABLE inquiry (4단계 DDL 그대로) + 3개 인덱스
5. SQLAlchemy 모델: Inquiry, Guardian에 user_id 필드 추가, AppUser role enum 확장
6. 시드 보강:
   - 보호자 3명 (boram/jiwon/hyeonu) INSERT, password bcrypt('test1234')
   - 기존 guardian 행에 user_id UPDATE (어르신 1·2·3에 매핑)
   - 시연용 inquiry 3건 INSERT (4단계 시드 그대로: SUCCESS·THRESHOLD_FALLBACK·READ 3가지)

Alembic 마이그레이션 파일 또는 ALTER 절차로.
```
`[확인]` `\d inquiry` 확인. `SELECT email,role FROM app_user;`에 GUARDIAN 3건 보이는가? 기존 직원·어르신·notice 데이터 그대로인가?

### [S5-2] 백엔드 — 권한 의존성 + 기존 라우터 보호
```
app/core/security.py(또는 deps.py)에 두 의존성을 만들어줘.
- require_guardian: role == 'GUARDIAN'만 통과, 그 외 403
- require_staff: role != 'GUARDIAN'만 통과 (CAREGIVER/SOCIAL_WORKER/ADMIN), 그 외 403

그리고 1·2·3·4차의 모든 기존 라우터에 require_staff 의존성을 추가해줘.
- auth/login은 예외 (공개 엔드포인트)
- 그 외 모든 보호된 엔드포인트

테스트: 시드 보호자(boram@family.kr/test1234)로 로그인 후 GET /api/residents/assigned 호출 → 403이 나와야 함.
```
`[확인]` 보호자 토큰으로 1차 알림장 API 호출 시 403? 직원 토큰으로는 기존대로 200?

### [S5-3] 백엔드 — 보호자 조회 API (인증 없는 첫 슬라이스)
```
신규 라우터 routers/parent.py에 6개 GET 엔드포인트 구현.
모두 require_guardian 의존성 적용. facility_id 토큰 자동 필터.

1. GET /api/parent/me
   - 보호자 user + 본인 어르신 목록(guardian.user_id == 토큰 user_id) + 4개 summary 카운트
   - summary: unreadBoardCount(최근 7일), unreadNoticeCount(read_at IS NULL인 SENT 알림장),
              newReportCount(read_at IS NULL인 리포트), pendingInquiryCount(본인 작성 중 UNREAD)

2. GET /api/parent/board, GET /api/parent/board/{id}
   - 4차 notice_board 데이터 재활용
   - 응답의 canEdit 항상 false 강제

3. GET /api/parent/notices, GET /api/parent/notices/{id}
   - 본인 어르신의 SENT + 현재본(MAX version)만
   - 상세 진입 시 read_at IS NULL이면 UPDATE
   - ★ 응답 필드 제한: finalText, sentAt, readAt, residentName만. raw_memo·ai_generated_texts·structured_status·participated_programs·author 모두 응답 제외.

4. GET /api/parent/reports, GET /api/parent/reports/{id}
   - 본인 어르신 리포트만
   - 상세 진입 시 read_at 자동 갱신
   - ★ stats_summary 응답 제외, finalText만

★ 권한 체크: 모든 단건 조회에 guardian → resident → notice/report JOIN으로 본인 어르신 데이터만 허용.
다른 어르신 ID 직접 호출 시 403.

테스트:
- 김보람 보호자로 GET /api/parent/notices → 김순자(id=1)의 알림장만 보임
- 김보람으로 GET /api/parent/notices/{박정호의 알림장 id} → 403
- GET /api/parent/notices/{id} 두 번 호출 시 read_at이 첫 호출에 갱신, 두 번째는 그대로
```
`[확인]` 보호자가 본인 어르신 데이터만 보는가? 다른 어르신 ID 직접 호출 시 403? read_at 갱신 정확? raw_memo·stats_summary가 응답에 없는가?

### [S5-4] 백엔드 — 문의 작성 + AI 분류 (핵심)
```
신규 라우터 routers/inquiries.py + services/classification_service.py 구현.

1. services/classification_service.py:
   - Gemini Structured Output (5차의 핵심)
   - 프롬프트 템플릿:
     "다음 보호자 문의를 5개 카테고리로 분류하세요.
      카테고리: HEALTH(건강), ADMIN_AFFAIRS(행정), VISIT(면회), MEAL(식단), OTHER(기타)
      각 카테고리의 신뢰도를 0~1 사이로 산출하세요. 합계는 1.0.
      문의: {content}"
   - response_schema: { "scores": { "HEALTH":float, "ADMIN_AFFAIRS":float, "VISIT":float, "MEAL":float, "OTHER":float } }
   - 임계치 .env CLASSIFICATION_THRESHOLD (기본 0.6)
   - 함수 반환: (category, confidence, scores, classification_status)
   - try/except로 LLM 실패 잡아서 ('OTHER', None, {}, LLM_ERROR_FALLBACK) 반환

2. POST /api/parent/inquiries (require_guardian)
   - 요청: residentId, title(선택), content(필수, 500자)
   - residentId가 본인 어르신인지 guardian 매핑 확인. 아니면 403.
   - classification_service 호출
   - 임계치 판정:
     · 4개 정답(HEALTH/ADMIN_AFFAIRS/VISIT/MEAL) 중 최고 ≥ 임계치 → 그 카테고리, SUCCESS
     · 모두 미달 → OTHER, THRESHOLD_FALLBACK
   - inquiry INSERT (모든 분류 정보 박제)
   - 응답 201: { id, category, status, createdAt } — confidence·classification_status 노출 X

3. GET /api/parent/inquiries (목록): 본인 작성 문의만
4. GET /api/parent/inquiries/{id} (상세): 본인 외 접근 403

★ 5차에서 502 LLM_ERROR를 절대 던지지 마. fallback으로 흡수.
★ confidence·classification_status·classification_scores는 어떤 응답에도 포함하지 마(DB만).

테스트:
1) "어머니 식사를 잘 못 드시는데 건강 괜찮으신지" → HEALTH로 분류되는가? SUCCESS 상태인가?
2) "안녕하세요" → THRESHOLD_FALLBACK + OTHER로 가는가?
3) Gemini API 키를 일부러 잘못 설정 → LLM_ERROR_FALLBACK + OTHER로 저장되지만 보호자에겐 정상 응답?
4) 김보람이 박정호(id=3) residentId로 문의 시도 → 403?
```
`[확인]` 3종 케이스(SUCCESS/THRESHOLD/LLM_ERROR) 모두 의도대로? 보호자에겐 confidence 안 보이지만 DB에 저장? LLM 502를 절대 응답으로 내보내지 않는가?

### [S5-5] 백엔드 — 직원 문의 처리 API
```
신규 라우터 (require_staff) 3개 추가.

1. GET /api/inquiries
   - 쿼리: category, status, limit, offset
   - facility_id 토큰 자동 필터, soft delete 제외
   - 미확인 우선 → 최신순
   - summary 필드: 미확인 총 수 + 카테고리별 카운트
   - 응답에 confidence·classification_status 노출 X
   - guardian.name과 resident.name, resident.roomNumber 조인

2. GET /api/inquiries/{id}
   - guardian(name, phone) + resident(name, roomNumber, careLevel, precautions) 함께 응답
   - precautions를 응답에 포함 — 직원 컨텍스트 핵심
   - confidence 노출 X

3. PATCH /api/inquiries/{id}/read
   - 본문 없음
   - status='READ', read_by=토큰 user_id, read_at=now() UPDATE
   - 이미 READ면 무동작·200 (idempotent)

4. 4차 /api/home/summary 응답에 inquiry.unreadCount 추가
   - 토큰 user의 facility_id에서 status=UNREAD인 inquiry 수
```
`[확인]` 직원 목록의 summary가 정확? 상세 응답에 precautions가 함께 나오는가? confidence가 응답에 없는가? PATCH /read 두 번 호출해도 안전한가?

### [S5-6] 프론트 — 보호자 로그인 + 홈
```
신규 페이지.

1. /login-parent
   - 직원 로그인과 별도 페이지. 디자인은 보호자 톤(미색 배경)
   - POST /api/auth/login 호출 (기존 재사용)
   - 응답의 user.role이 GUARDIAN이 아니면 에러 ("직원은 직원 로그인을 이용해주세요" + /login 링크)
   - 성공 시 /parent/home 이동

2. /parent/home
   - 배경 #FBF7F2
   - 헤더: 로고+서비스명, 시설명, 날짜, 보호자명·드롭다운(로그아웃)
   - 어르신 카드 (멀티 어르신이면 드롭다운 자동 노출)
   - 4개 카드 가로 1줄: 공지사항 → 받은 알림장 → 주간 리포트 → 문의하기
     · 각 카드에 미확인 카운트 + 빨간 점
   - 데이터: GET /api/parent/me 단일 호출
   - 직원 컴포넌트(/home 등)와 시각 구분 명확하게

3. 라우팅 가드: 로그인한 user.role이 GUARDIAN인데 직원 경로 접근 시 /parent/home 리다이렉트. 그 반대도 마찬가지.

★ 컴포넌트 직접 fetch 금지, src/api/parent.ts 경유.
★ 1·2·3·4차 직원 화면은 절대 건드리지 마.
```
`[확인]` 김보람(보호자)으로 로그인 시 /parent/home 진입? 직원 로그인으로 /parent/home 접근 시 막히는가? 4개 카드 카운트 정확?

### [S5-7] 프론트 — 보호자 조회 화면 (공지·알림장·리포트)
```
보호자가 받은 콘텐츠 3종 화면 구현.

1. /parent/board, /parent/board/{id}
   - 4차 게시판 디자인 재활용 (읽기 전용 모드)
   - 작성·수정·삭제 버튼 없음
   - 데이터: GET /api/parent/board, /{id}

2. /parent/notices (목록), /parent/notices/{id} (상세)
   - 목록: 날짜 + preview + 미확인 점 (readAt이 null이면 점)
   - 상세: finalText만 표시. raw_memo·structured_status·programs 등 표시 금지
   - 상세 진입 시 read_at 자동 갱신은 서버가 처리

3. /parent/reports (목록), /parent/reports/{id} (상세)
   - 동일 패턴
   - 상세: finalText만. statsSummary 노출 X (보호자에겐 통계 raw 숫자 안 보여줌 — 2단계 결정)

★ 보호자 화면은 직원이 보던 내부 메타(작성자명, raw_memo, 분류 점수 등)를 절대 노출하지 않는다.
```
`[확인]` 보호자가 본인 어르신 콘텐츠만 보이는가? raw_memo·statsSummary가 어디에도 안 보이는가? 상세 진입 후 다시 목록 가면 미확인 점이 사라지는가?

### [S5-8] 프론트 — 문의 작성·조회 (보호자) + AI 분류 UX
```
1. /parent/inquiries (목록): 카드 = 카테고리 뱃지 + preview + 상태("확인 대기"/"확인 완료") + 작성일
   - 신뢰도 표시 절대 금지
   - [+ 새 문의 작성] → /parent/inquiries/new

2. /parent/inquiries/new
   - 어르신 표시(자동, 멀티면 드롭다운)
   - 제목 input (선택, 100자)
   - 본문 textarea (필수, 500자, 카운터)
   - 카테고리 선택 UI는 절대 만들지 마 (AI 자동 분류가 핵심)
   - [전송] 버튼: 빈 본문이면 disabled, 클릭 즉시 disabled + "전송 중..." (방어 3)
   - POST /api/parent/inquiries 호출 (3~5초 대기)
   - 성공 → 토스트 "문의가 등록되었습니다. 직원이 확인 후 답변드립니다." → /parent/inquiries 복귀

3. /parent/inquiries/{id}: 본인 작성 + 카테고리 뱃지 + 상태. 답변 영역 없음.
```
`[확인]` 보호자가 카테고리를 선택하는 UI가 없는가? 전송 시 3~5초 대기가 견딜만한가? 신뢰도가 어디에도 안 보이는가?

### [S5-9] 프론트 — 직원 문의 처리 화면
```
1. 4차 홈 그리드의 "보호자 문의" 카드를 비활성에서 활성으로 변경
   - 미확인 카운트(/api/home/summary의 inquiry.unreadCount) + 빨간 점
   - 클릭 → /inquiries

2. /inquiries (직원 목록)
   - 상단 카테고리 필터 칩: [전체][건강][행정][면회][식단][기타]
   - [미확인만 보기] 토글
   - 카드: 카테고리 뱃지 + preview + 작성자(가족명·어르신·호실) + 작성일 + 미확인 점
   - 신뢰도 절대 표시 금지
   - 정렬: 미확인 먼저 → 최신순
   - 데이터: GET /api/inquiries (쿼리로 필터 전달)

3. /inquiries/{id} (직원 상세)
   - 큰 카테고리 뱃지 (예: "건강")
   - 작성자: 보호자명 + (어르신 가족) + 전화
   - ★ 어르신 컨텍스트 박스: 이름·호실·등급 + precautions
   - 본문 전체
   - 상태 표시 + [확인 완료로 표시] (UNREAD일 때만)
   - 클릭 → PATCH /api/inquiries/{id}/read → 상태 갱신
   - 답변 작성 UI는 절대 만들지 마 (5차 범위 밖)

★ 신뢰도·classification_status를 직원 UI에도 노출하지 마.
```
`[확인]` 직원이 카테고리 필터로 [건강]만 보면 건강 문의만? 상세에 precautions 함께 표시? [확인 완료] 누르면 상태 갱신되고 다시 누르면 무동작?

### [S5-10] 마무리 점검 (5차)
```
5차 기능 전체와 1~4차 회귀 점검.
- 보호자 본인 어르신 외 데이터 접근 시도 → 403 (보안 핵심)
- 보호자 토큰으로 기존 직원 API 호출 시도 → 403
- 직원 토큰으로 /api/parent/* 호출 시도 → 403
- 분류 3종 케이스 (SUCCESS / THRESHOLD_FALLBACK / LLM_ERROR_FALLBACK) 모두 시드로 확인 가능
- read_at 갱신: 알림장·리포트 상세 진입 후 미확인 점 사라짐
- 신뢰도가 어떤 응답·어떤 화면에도 노출되지 않음 (가장 흔한 실수 — 직원 상세에 살짝 노출되기 쉬움)
- 1~4차 회귀: 김민지(직원)로 로그인해 알림장 작성·리포트 생성·공지 작성·어르신 편집 모두 정상
- 범위 밖(답변 작성 UI, 첨부 파일, 푸시 알림, 회원가입, 본인 확인) 실수로 만들었으면 제거
```
`[확인]` 1~5차 모두 회귀 통과? 보안 시나리오 3종 모두 막힘? 신뢰도가 정말 어디에도 안 보이는가?

### AI에게 시킬 때 황금 규칙 (5차 추가)
- **보호자도 app_user**, 별도 테이블 만들지 마.
- 모든 라우터에 require_guardian 또는 require_staff 둘 중 하나 강제.
- 보호자 단건 조회는 guardian → resident → 데이터 JOIN으로 본인 어르신만.
- **confidence는 DB에만, 응답·UI 어디에도 노출 금지** — 가장 흔한 실수.
- LLM 실패는 fallback으로 흡수. 502를 절대 보호자 응답으로 내보내지 마.
- 보호자 응답에 raw_memo·ai_generated_texts·structured_status·stats_summary 포함 금지.
- 5차에서 답변 작성 UI 만들지 마 (6차 이후).
- 임계치 0.6은 .env(CLASSIFICATION_THRESHOLD) 변수로 — 하드코딩 금지.
- 김보람(보호자) ↔ 박정호 알림장 접근 시도는 5차 보안 시금석. 매번 확인.

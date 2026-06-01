-- =============================================================
-- 케어알림장 — 3~8차 스프린트 누락 마이그레이션
-- 실행: docker exec -i carealimjang-db psql -U postgres -d care_notice < migrate_sprint3_8.sql
-- =============================================================

-- ─── 1. user_role 에 GUARDIAN 추가 ────────────────────────────────────────────
-- ALTER TYPE ADD VALUE 는 트랜잭션 블록 밖에서만 실행 가능
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GUARDIAN';

-- ─── 2. guardian 테이블에 user_id 컬럼 추가 (5차) ────────────────────────────
ALTER TABLE guardian
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_user(id);

-- ─── 3. 누락된 ENUM 타입 생성 ─────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE inquiry_category AS ENUM ('HEALTH', 'ADMIN_AFFAIRS', 'VISIT', 'MEAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inquiry_status AS ENUM ('UNREAD', 'READ', 'ANSWERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE classification_status AS ENUM ('SUCCESS', 'THRESHOLD_FALLBACK', 'LLM_ERROR_FALLBACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE meal_type AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE schedule_event_type AS ENUM ('FACILITY_EVENT', 'BIRTHDAY', 'HOLIDAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. 누락된 테이블 생성 ─────────────────────────────────────────────────────

-- report (3차)
CREATE TABLE IF NOT EXISTS report (
    id                BIGSERIAL PRIMARY KEY,
    resident_id       BIGINT NOT NULL REFERENCES resident(id),
    author_id         BIGINT NOT NULL REFERENCES app_user(id),
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    recorded_days     SMALLINT NOT NULL,
    stats_summary     JSONB NOT NULL,
    source_notice_ids JSONB NOT NULL DEFAULT '[]',
    tone              notice_tone   NOT NULL DEFAULT 'POLITE',
    ai_generated_text TEXT,
    final_text        TEXT,
    status            notice_status NOT NULL DEFAULT 'DRAFT',
    sent_at           TIMESTAMPTZ,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_report_resident_period
    ON report (resident_id, period_start) WHERE deleted_at IS NULL;

-- notice_board (4차)
CREATE TABLE IF NOT EXISTS notice_board (
    id          BIGSERIAL PRIMARY KEY,
    facility_id BIGINT NOT NULL REFERENCES facility(id),
    author_id   BIGINT NOT NULL REFERENCES app_user(id),
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notice_board_facility
    ON notice_board (facility_id) WHERE deleted_at IS NULL;

-- inquiry (5차)
CREATE TABLE IF NOT EXISTS inquiry (
    id                    BIGSERIAL PRIMARY KEY,
    guardian_user_id      BIGINT NOT NULL REFERENCES app_user(id),
    resident_id           BIGINT NOT NULL REFERENCES resident(id),
    facility_id           BIGINT NOT NULL REFERENCES facility(id),
    title                 VARCHAR(100),
    content               TEXT NOT NULL,
    category              inquiry_category NOT NULL,
    confidence            FLOAT,
    classification_scores JSONB NOT NULL DEFAULT '{}',
    classification_status classification_status NOT NULL,
    status                inquiry_status NOT NULL DEFAULT 'UNREAD',
    read_by               BIGINT REFERENCES app_user(id),
    read_at               TIMESTAMPTZ,
    answer_read_at        TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inquiry_facility_status
    ON inquiry (facility_id, status) WHERE deleted_at IS NULL;

-- inquiry_answer (8차)
CREATE TABLE IF NOT EXISTS inquiry_answer (
    id          BIGSERIAL PRIMARY KEY,
    inquiry_id  BIGINT NOT NULL REFERENCES inquiry(id),
    author_id   BIGINT NOT NULL REFERENCES app_user(id),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- meal_log (6차)
CREATE TABLE IF NOT EXISTS meal_log (
    id          BIGSERIAL PRIMARY KEY,
    facility_id BIGINT NOT NULL REFERENCES facility(id),
    author_id   BIGINT NOT NULL REFERENCES app_user(id),
    meal_date   DATE NOT NULL,
    meal_type   meal_type NOT NULL,
    menu_text   TEXT NOT NULL,
    photos      JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_log_date_type
    ON meal_log (facility_id, meal_date, meal_type) WHERE deleted_at IS NULL;

-- schedule_event (6차)
CREATE TABLE IF NOT EXISTS schedule_event (
    id          BIGSERIAL PRIMARY KEY,
    facility_id BIGINT NOT NULL REFERENCES facility(id),
    author_id   BIGINT REFERENCES app_user(id),
    event_date  DATE NOT NULL,
    event_type  schedule_event_type NOT NULL,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    resident_id BIGINT REFERENCES resident(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_schedule_event_facility_date
    ON schedule_event (facility_id, event_date) WHERE deleted_at IS NULL;

-- album (7차)
CREATE TABLE IF NOT EXISTS album (
    id            BIGSERIAL PRIMARY KEY,
    facility_id   BIGINT NOT NULL REFERENCES facility(id),
    author_id     BIGINT NOT NULL REFERENCES app_user(id),
    activity_date TIMESTAMP NOT NULL,
    title         VARCHAR(100) NOT NULL,
    description   TEXT,
    photos        JSONB NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_album_facility_date
    ON album (facility_id, activity_date) WHERE deleted_at IS NULL;

-- album_resident (7차 N:M)
CREATE TABLE IF NOT EXISTS album_resident (
    album_id    BIGINT NOT NULL REFERENCES album(id) ON DELETE CASCADE,
    resident_id BIGINT NOT NULL REFERENCES resident(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (album_id, resident_id)
);

-- ─── 5. 비밀번호 해시 업데이트 (test1234) ─────────────────────────────────────
UPDATE app_user
SET password_hash = '$2b$12$T1Tlmm5Qk7OyKA6V16xLIe1si6X74unmXWZH7WYO5Y5w2bXx/MF0C'
WHERE email IN ('minji@happy.kr', 'seojun@happy.kr', 'admin@happy.kr');

-- ─── 6. 누락 직원 계정 추가 ───────────────────────────────────────────────────

-- 외국인 직원 후엉 (2차, 베트남어)
INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang)
SELECT 1, 'huong@happy.kr',
       '$2b$12$T1Tlmm5Qk7OyKA6V16xLIe1si6X74unmXWZH7WYO5Y5w2bXx/MF0C',
       '후엉', 'CAREGIVER', 'vi'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'huong@happy.kr' AND deleted_at IS NULL);

-- ─── 7. 보호자 app_user 계정 추가 + guardian 연결 (5차) ──────────────────────

-- 보호자 계정 삽입
INSERT INTO app_user (facility_id, email, password_hash, name, role)
SELECT 1, 'boram@family.kr',
       '$2b$12$T1Tlmm5Qk7OyKA6V16xLIe1si6X74unmXWZH7WYO5Y5w2bXx/MF0C',
       '김보람', 'GUARDIAN'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'boram@family.kr' AND deleted_at IS NULL);

INSERT INTO app_user (facility_id, email, password_hash, name, role)
SELECT 1, 'jiwon@family.kr',
       '$2b$12$T1Tlmm5Qk7OyKA6V16xLIe1si6X74unmXWZH7WYO5Y5w2bXx/MF0C',
       '이지원', 'GUARDIAN'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'jiwon@family.kr' AND deleted_at IS NULL);

INSERT INTO app_user (facility_id, email, password_hash, name, role)
SELECT 1, 'hyeonu@family.kr',
       '$2b$12$T1Tlmm5Qk7OyKA6V16xLIe1si6X74unmXWZH7WYO5Y5w2bXx/MF0C',
       '박현우', 'GUARDIAN'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'hyeonu@family.kr' AND deleted_at IS NULL);

-- guardian.user_id 연결 (guardian 레코드 id 1,2,3 이 각 보호자와 대응)
UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email = 'boram@family.kr')
WHERE resident_id = 1 AND user_id IS NULL;

UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email = 'jiwon@family.kr')
WHERE resident_id = 2 AND user_id IS NULL;

UPDATE guardian SET user_id = (SELECT id FROM app_user WHERE email = 'hyeonu@family.kr')
WHERE resident_id = 3 AND user_id IS NULL;

-- ─── 8. 후엉 담당 배정 ────────────────────────────────────────────────────────
INSERT INTO assignment (user_id, resident_id)
SELECT (SELECT id FROM app_user WHERE email = 'huong@happy.kr'), r
FROM unnest(ARRAY[1,2,3,4,5,6,7,8]) AS r
WHERE NOT EXISTS (
    SELECT 1 FROM assignment
    WHERE user_id = (SELECT id FROM app_user WHERE email = 'huong@happy.kr')
      AND resident_id = r
      AND deleted_at IS NULL
);

-- ─── 9. 시드: 공지사항 (4차 시연용) ──────────────────────────────────────────
INSERT INTO notice_board (facility_id, author_id, title, content)
SELECT 1, 2,
       '2026년 6월 시설 소식',
       '안녕하세요 보호자님, 6월에는 어버이날 행사와 실버 체조 특별 프로그램이 준비되어 있습니다. 많은 관심 부탁드립니다.'
WHERE NOT EXISTS (SELECT 1 FROM notice_board WHERE facility_id = 1 AND deleted_at IS NULL LIMIT 1);

-- ─── 10. 시드: 일정표 (6차 시연용 — 공휴일·행사) ─────────────────────────────
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title)
SELECT 1, NULL, '2026-06-06', 'HOLIDAY', '현충일'
WHERE NOT EXISTS (SELECT 1 FROM schedule_event WHERE event_date = '2026-06-06' AND facility_id = 1);

INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, description)
SELECT 1, 2, '2026-06-15', 'FACILITY_EVENT', '여름 맞이 행사', '시원한 식혜와 함께하는 여름 맞이 프로그램'
WHERE NOT EXISTS (SELECT 1 FROM schedule_event WHERE event_date = '2026-06-15' AND facility_id = 1);

-- 어르신 생일 (김순자 1943-03-11 → 2026년 생일 이미 지남, 다음 생일 2027-03-11)
INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, resident_id)
SELECT 1, 2, '2027-03-11', 'BIRTHDAY', '김순자 어르신 생신', 1
WHERE NOT EXISTS (SELECT 1 FROM schedule_event WHERE event_date = '2027-03-11' AND resident_id = 1);

-- ─── 11. 시드: 보호자 문의 (5·8차 시연용) ────────────────────────────────────

-- 김보람(김순자 가족) HEALTH 문의 = UNREAD (라이브 시연용)
INSERT INTO inquiry (guardian_user_id, resident_id, facility_id, content,
                     category, confidence, classification_scores, classification_status, status)
SELECT
    (SELECT id FROM app_user WHERE email = 'boram@family.kr'),
    1, 1,
    '어머니 요즘 식사를 잘 못 드신다고 들었는데 건강 상태가 어떠신지 걱정됩니다.',
    'HEALTH', 0.91,
    '{"HEALTH":0.91,"ADMIN_AFFAIRS":0.03,"VISIT":0.02,"MEAL":0.02,"OTHER":0.02}'::jsonb,
    'SUCCESS', 'UNREAD'
WHERE NOT EXISTS (
    SELECT 1 FROM inquiry
    WHERE guardian_user_id = (SELECT id FROM app_user WHERE email = 'boram@family.kr')
      AND deleted_at IS NULL
);

-- 박현우(박정호 가족) VISIT 문의 = ANSWERED (보호자 답변 확인 시연용)
INSERT INTO inquiry (id, guardian_user_id, resident_id, facility_id, content,
                     category, confidence, classification_scores, classification_status,
                     status, read_by, read_at)
SELECT
    100,
    (SELECT id FROM app_user WHERE email = 'hyeonu@family.kr'),
    3, 1,
    '아버지 면회 가능한 시간이 언제인지 알고 싶습니다. 토요일 오후도 가능한가요?',
    'VISIT', 0.87,
    '{"HEALTH":0.05,"ADMIN_AFFAIRS":0.04,"VISIT":0.87,"MEAL":0.02,"OTHER":0.02}'::jsonb,
    'SUCCESS', 'ANSWERED',
    2, now() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM inquiry WHERE id = 100);

-- 박현우 문의에 대한 답변 (8차)
INSERT INTO inquiry_answer (inquiry_id, author_id, content)
SELECT
    100, 2,
    '안녕하세요 보호자님. 토요일 오후 2시부터 4시 사이에 면회 가능하십니다. 면회실에서 30분 정도 시간을 마련해 두겠습니다. 따뜻한 옷차림으로 오시면 정원에서도 함께 시간 보내실 수 있습니다.'
WHERE NOT EXISTS (SELECT 1 FROM inquiry_answer WHERE inquiry_id = 100 AND deleted_at IS NULL);

-- ─── 12. 시드: 앨범 (7차 시연용) ────────────────────────────────────────────

-- 실버 체조 앨범 (박정호 미참여 — 와상)
WITH ins AS (
    INSERT INTO album (facility_id, author_id, activity_date, title, description, photos)
    SELECT 1, 1,
           '2026-05-20 14:00:00',
           '실버 체조 시간',
           '오후 강당에서 진행한 가벼운 스트레칭 활동입니다.',
           '[]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM album WHERE title = '실버 체조 시간' AND facility_id = 1)
    RETURNING id
)
INSERT INTO album_resident (album_id, resident_id)
SELECT ins.id, r
FROM ins, unnest(ARRAY[1,2,4,5,6,7,8]) AS r;  -- 박정호(3) 제외

-- 어버이날 앨범 (전 어르신 참여)
WITH ins AS (
    INSERT INTO album (facility_id, author_id, activity_date, title, description, photos)
    SELECT 1, 2,
           '2026-05-08 14:00:00',
           '어버이날 행사',
           '가족분들과 함께하는 따뜻한 시간이었습니다.',
           '[]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM album WHERE title = '어버이날 행사' AND facility_id = 1)
    RETURNING id
)
INSERT INTO album_resident (album_id, resident_id)
SELECT ins.id, r
FROM ins, unnest(ARRAY[1,2,3,4,5,6,7,8]) AS r;

-- ─── 13. 시퀀스 보정 ─────────────────────────────────────────────────────────
SELECT setval('app_user_id_seq', GREATEST((SELECT MAX(id) FROM app_user), 10));

-- ─── 14. 신규 테이블 권한 부여 ───────────────────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO carealimjang;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO carealimjang;
GRANT ALL PRIVILEGES ON SCHEMA public TO carealimjang;

-- 완료 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

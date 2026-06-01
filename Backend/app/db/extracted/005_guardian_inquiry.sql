-- =============================================================
-- 5차 스프린트: 보호자 채널 + AI 문의 분류
--   변경:
--     1) user_role enum에 GUARDIAN 추가
--     2) 신규 enum 3종 (inquiry_category, inquiry_status, classification_status)
--     3) guardian에 user_id 컬럼 추가 + 부분 인덱스
--     4) 신규 테이블 inquiry + 인덱스 3개
--     5) 시드: 보호자 3명 app_user, guardian.user_id 매핑, inquiry 3건
--
-- 적용:
--   Get-Content app/db/migrations/005_guardian_inquiry.sql |
--     docker exec -i care-postgres psql -U postgres -d care_notice
-- =============================================================

-- ─── 1) user_role enum에 GUARDIAN 추가 ────────────────────────────────────────
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GUARDIAN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2) 신규 enum 3종 ──────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE inquiry_category AS ENUM (
        'HEALTH', 'ADMIN_AFFAIRS', 'VISIT', 'MEAL', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE inquiry_status AS ENUM ('UNREAD', 'READ');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE classification_status AS ENUM (
        'SUCCESS',
        'THRESHOLD_FALLBACK',
        'LLM_ERROR_FALLBACK'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3) guardian 테이블: user_id 컬럼 추가 ─────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE guardian ADD COLUMN user_id BIGINT REFERENCES app_user(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_guardian_user
    ON guardian (user_id)
    WHERE deleted_at IS NULL;

-- ─── 4) inquiry 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiry (
    id                     BIGSERIAL PRIMARY KEY,
    guardian_user_id       BIGINT NOT NULL REFERENCES app_user(id),
    resident_id            BIGINT NOT NULL REFERENCES resident(id),
    facility_id            BIGINT NOT NULL REFERENCES facility(id),
    title                  VARCHAR(100),
    content                TEXT NOT NULL,
    category               inquiry_category NOT NULL,
    confidence             FLOAT,
    classification_scores  JSONB NOT NULL DEFAULT '{}',
    classification_status  classification_status NOT NULL,
    status                 inquiry_status NOT NULL DEFAULT 'UNREAD',
    read_by                BIGINT REFERENCES app_user(id),
    read_at                TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inquiry_facility_status_recent
    ON inquiry (facility_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiry_guardian_recent
    ON inquiry (guardian_user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiry_category
    ON inquiry (category);

-- ─── 5) 시드: 보호자 3명 ───────────────────────────────────────────────────────
-- GUARDIAN enum이 같은 세션에서 추가됐으므로 EXECUTE로 파서 캐시 우회
DO $$
DECLARE
    guardian_count INT;
    boram_id BIGINT;
    jiwon_id BIGINT;
    hyeonu_id BIGINT;
    pw_hash TEXT := '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaLbMFCNj.j5.d1E2vJrH1A5i';
BEGIN
    SELECT COUNT(*) INTO guardian_count
    FROM app_user WHERE email IN ('boram@family.kr','jiwon@family.kr','hyeonu@family.kr');

    IF guardian_count > 0 THEN
        RAISE NOTICE '보호자 시드 이미 존재 (%건) — INSERT 건너뜀', guardian_count;
    ELSE
        EXECUTE format(
            'INSERT INTO app_user (facility_id, email, password_hash, name, role) VALUES
             (1, %L, %L, %L, %L::user_role),
             (1, %L, %L, %L, %L::user_role),
             (1, %L, %L, %L, %L::user_role)',
            'boram@family.kr',  pw_hash, '김보람', 'GUARDIAN',
            'jiwon@family.kr',  pw_hash, '이지원', 'GUARDIAN',
            'hyeonu@family.kr', pw_hash, '박현우', 'GUARDIAN'
        );
        RAISE NOTICE '보호자 3명 INSERT 완료';
    END IF;

    -- guardian.user_id 매핑 (resident_id 1·2·3에 각각)
    SELECT id INTO boram_id   FROM app_user WHERE email = 'boram@family.kr';
    SELECT id INTO jiwon_id   FROM app_user WHERE email = 'jiwon@family.kr';
    SELECT id INTO hyeonu_id  FROM app_user WHERE email = 'hyeonu@family.kr';

    UPDATE guardian SET user_id = boram_id   WHERE resident_id = 1 AND user_id IS NULL;
    UPDATE guardian SET user_id = jiwon_id   WHERE resident_id = 2 AND user_id IS NULL;
    UPDATE guardian SET user_id = hyeonu_id  WHERE resident_id = 3 AND user_id IS NULL;

    RAISE NOTICE 'guardian.user_id 매핑 완료';

    -- 문의 시드: 분류 케이스 3종 (SUCCESS / THRESHOLD_FALLBACK / READ)
    IF (SELECT COUNT(*) FROM inquiry) = 0 THEN
        INSERT INTO inquiry (
            guardian_user_id, resident_id, facility_id,
            title, content,
            category, confidence, classification_scores, classification_status,
            status
        ) VALUES
        (boram_id, 1, 1,
         NULL, '어머니 식사를 잘 못 드시는데 건강 상태가 걱정됩니다. 요즘 어떠신가요?',
         'HEALTH', 0.91,
         '{"HEALTH":0.91,"ADMIN_AFFAIRS":0.03,"VISIT":0.02,"MEAL":0.02,"OTHER":0.02}',
         'SUCCESS', 'UNREAD'),
        (jiwon_id, 2, 1,
         NULL, '안녕하세요, 잘 지내시죠?',
         'OTHER', 0.42,
         '{"HEALTH":0.30,"ADMIN_AFFAIRS":0.15,"VISIT":0.13,"MEAL":0.00,"OTHER":0.42}',
         'THRESHOLD_FALLBACK', 'UNREAD'),
        (hyeonu_id, 3, 1,
         '면회 신청', '이번 주 토요일 오후 2시에 아버지를 면회하고 싶습니다. 가능한지 확인 부탁드립니다.',
         'VISIT', 0.88,
         '{"HEALTH":0.04,"ADMIN_AFFAIRS":0.05,"VISIT":0.88,"MEAL":0.01,"OTHER":0.02}',
         'SUCCESS', 'READ');

        RAISE NOTICE '문의 시드 3건 INSERT 완료';
    ELSE
        RAISE NOTICE '문의 시드 이미 존재 — 건너뜀';
    END IF;
END $$;

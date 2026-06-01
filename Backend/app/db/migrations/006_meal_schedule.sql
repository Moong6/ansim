-- =============================================================
-- 6차 스프린트: 식단표 + 일정표
--   변경:
--     1) 신규 enum 2종 (meal_type, schedule_event_type)
--     2) 신규 테이블 meal_log + 인덱스 2개(UNIQUE 포함)
--     3) 신규 테이블 schedule_event + 인덱스 2개
--     4) 시드: meal_log 5건, schedule_event (공휴일 14건 + 시설행사 3건 + 생일 3건)
--
-- 적용:
--   Get-Content app/db/migrations/006_meal_schedule.sql |
--     docker exec -i care-postgres psql -U postgres -d care_notice
-- =============================================================

-- ─── 1) 신규 enum 2종 ──────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE meal_type AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE schedule_event_type AS ENUM ('FACILITY_EVENT', 'BIRTHDAY', 'HOLIDAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2) meal_log 테이블 ────────────────────────────────────────────────────────

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

-- 같은 시설+날짜+식사구분 중복 방지 (soft delete 미제외만)
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_log_facility_date_type
    ON meal_log (facility_id, meal_date, meal_type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meal_log_facility_date
    ON meal_log (facility_id, meal_date) WHERE deleted_at IS NULL;

-- ─── 3) schedule_event 테이블 ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedule_event (
    id          BIGSERIAL PRIMARY KEY,
    facility_id BIGINT NOT NULL REFERENCES facility(id),
    author_id   BIGINT REFERENCES app_user(id),           -- 공휴일 시드는 NULL
    event_date  DATE NOT NULL,
    event_type  schedule_event_type NOT NULL,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    resident_id BIGINT REFERENCES resident(id),           -- BIRTHDAY일 때만 NOT NULL
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedule_event_facility_date
    ON schedule_event (facility_id, event_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_event_birthday
    ON schedule_event (resident_id)
    WHERE deleted_at IS NULL AND event_type = 'BIRTHDAY';

-- ─── 4) 시드 데이터 ────────────────────────────────────────────────────────────

DO $$
DECLARE
    editor_id  BIGINT;
    meal_count INT;
    sched_count INT;
BEGIN
    -- SOCIAL_WORKER(박서준) id 조회
    SELECT id INTO editor_id
    FROM app_user
    WHERE role = 'SOCIAL_WORKER' AND deleted_at IS NULL
    LIMIT 1;

    IF editor_id IS NULL THEN
        RAISE NOTICE 'SOCIAL_WORKER 계정을 찾지 못함 — meal_log 시드 건너뜀';
    END IF;

    -- ── meal_log 시드 ─────────────────────────────────────────────────────────
    SELECT COUNT(*) INTO meal_count FROM meal_log WHERE deleted_at IS NULL;

    IF meal_count > 0 THEN
        RAISE NOTICE 'meal_log 시드 이미 존재 (%)건 — 건너뜀', meal_count;
    ELSIF editor_id IS NOT NULL THEN
        EXECUTE format(
            'INSERT INTO meal_log (facility_id, author_id, meal_date, meal_type, menu_text, photos) VALUES
             -- 오늘 식사 3건
             (1, %s, CURRENT_DATE, %L::meal_type, %L, %L::jsonb),
             (1, %s, CURRENT_DATE, %L::meal_type, %L, %L::jsonb),
             (1, %s, CURRENT_DATE, %L::meal_type, %L, %L::jsonb),
             -- 어제 저녁 1건
             (1, %s, CURRENT_DATE - 1, %L::meal_type, %L, %L::jsonb),
             -- 그제 점심 1건
             (1, %s, CURRENT_DATE - 2, %L::meal_type, %L, %L::jsonb)',
            editor_id, 'BREAKFAST', '잡곡밥' || chr(10) || '된장국' || chr(10) || '계란찜' || chr(10) || '깍두기',
                '[]'::text,
            editor_id, 'LUNCH',     '쌀밥' || chr(10) || '미역국' || chr(10) || '고등어구이' || chr(10) || '시금치나물' || chr(10) || '배추김치',
                '[{"url":"/static/meals/sample/lunch_sample.jpg","uploadedAt":"2026-05-27T12:00:00+09:00"}]'::text,
            editor_id, 'SNACK',     '딸기 요거트' || chr(10) || '바나나',
                '[]'::text,
            editor_id, 'DINNER',    '잡곡밥' || chr(10) || '순두부찌개' || chr(10) || '연근조림' || chr(10) || '배추김치',
                '[]'::text,
            editor_id, 'LUNCH',     '쌀밥' || chr(10) || '갈비탕' || chr(10) || '총각김치' || chr(10) || '콩나물무침',
                '[{"url":"/static/meals/sample/lunch_sample2.jpg","uploadedAt":"2026-05-26T12:00:00+09:00"}]'::text
        );
        RAISE NOTICE 'meal_log 시드 5건 INSERT 완료';
    END IF;

    -- ── schedule_event 시드 ───────────────────────────────────────────────────
    SELECT COUNT(*) INTO sched_count FROM schedule_event WHERE deleted_at IS NULL;

    IF sched_count > 0 THEN
        RAISE NOTICE 'schedule_event 시드 이미 존재 (%)건 — 건너뜀', sched_count;
    ELSE
        -- 2026년 한국 공휴일 14건 (author_id NULL)
        INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title) VALUES
        (1, NULL, '2026-01-01', 'HOLIDAY', '신정'),
        (1, NULL, '2026-01-28', 'HOLIDAY', '설날 전날'),
        (1, NULL, '2026-01-29', 'HOLIDAY', '설날'),
        (1, NULL, '2026-01-30', 'HOLIDAY', '설날 다음날'),
        (1, NULL, '2026-03-01', 'HOLIDAY', '삼일절'),
        (1, NULL, '2026-05-05', 'HOLIDAY', '어린이날'),
        (1, NULL, '2026-05-24', 'HOLIDAY', '부처님오신날'),
        (1, NULL, '2026-06-06', 'HOLIDAY', '현충일'),
        (1, NULL, '2026-08-15', 'HOLIDAY', '광복절'),
        (1, NULL, '2026-09-24', 'HOLIDAY', '추석 전날'),
        (1, NULL, '2026-09-25', 'HOLIDAY', '추석'),
        (1, NULL, '2026-09-26', 'HOLIDAY', '추석 다음날'),
        (1, NULL, '2026-10-03', 'HOLIDAY', '개천절'),
        (1, NULL, '2026-12-25', 'HOLIDAY', '성탄절');

        RAISE NOTICE '공휴일 시드 14건 INSERT 완료';

        -- 시설 행사 3건
        IF editor_id IS NOT NULL THEN
            INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, description) VALUES
            (1, editor_id, '2026-05-08', 'FACILITY_EVENT', '어버이날 행사',
             '어버이날을 맞아 어르신들을 위한 특별 행사를 진행합니다. 카네이션 증정 및 문화공연 예정.'),
            (1, editor_id, '2026-05-18', 'FACILITY_EVENT', '실버체조 대회',
             '봄맞이 실버체조 대회를 개최합니다. 시상 및 기념품 증정 예정.'),
            (1, editor_id, '2026-06-01', 'FACILITY_EVENT', '6월 생일잔치',
             '6월에 생일을 맞이하시는 어르신들을 위한 특별 생일잔치입니다.');

            RAISE NOTICE '시설 행사 시드 3건 INSERT 완료';
        END IF;

        -- 어르신 생일 3건 (resident_id 1=김순자, 2=이복남, 3=박정호)
        INSERT INTO schedule_event (facility_id, author_id, event_date, event_type, title, resident_id) VALUES
        (1, editor_id, '2026-05-11', 'BIRTHDAY', '김순자 어르신 생신', 1),
        (1, editor_id, '2026-07-22', 'BIRTHDAY', '이복남 어르신 생신', 2),
        (1, editor_id, '2026-12-05', 'BIRTHDAY', '박정호 어르신 생신', 3);

        RAISE NOTICE '어르신 생일 시드 3건 INSERT 완료';
    END IF;
END $$;

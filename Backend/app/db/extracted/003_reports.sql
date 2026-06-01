-- =============================================================
-- 3차 스프린트: 주간 안심 리포트
--   - 신규 테이블 1개: report  (+ 부분 인덱스 1개)
--   - enum 은 1차 notice_tone / notice_status 재사용 (새 enum 안 만듦)
--   - 데모용 시드: 김순자(id=1) 지난주 월~금 notice 5건 (상태 분포 다양)
--
-- 적용:
--   Get-Content app/db/migrations/003_reports.sql |
--     docker exec -i care-postgres psql -U postgres -d care_notice
--
-- 재실행 안전성:
--   CREATE TABLE / INDEX 는 IF NOT EXISTS, 시드는 기존 행 카운트로 가드
-- =============================================================

-- ─── 1) 신규 테이블 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report (
    id                BIGSERIAL PRIMARY KEY,
    resident_id       BIGINT NOT NULL REFERENCES resident(id),
    author_id         BIGINT NOT NULL REFERENCES app_user(id),

    period_start      DATE NOT NULL,                          -- 월요일
    period_end        DATE NOT NULL,                          -- 일요일
    recorded_days     SMALLINT NOT NULL,                      -- 0~7

    stats_summary     JSONB NOT NULL,                         -- 코드 집계
    source_notice_ids JSONB NOT NULL DEFAULT '[]',            -- 근거 notice id 배열

    tone              notice_tone   NOT NULL DEFAULT 'POLITE', -- 1차 enum 재사용
    ai_generated_text TEXT,                                    -- AI 원본
    final_text        TEXT,                                    -- 직원 편집본 (UPDATE 금지)

    status            notice_status NOT NULL DEFAULT 'DRAFT',  -- 1차 enum 재사용
    sent_at           TIMESTAMPTZ,
    read_at           TIMESTAMPTZ,                             -- 보호자 읽음 시각

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

-- 어르신 × 주차 조회 가속 (활성 행만)
CREATE INDEX IF NOT EXISTS idx_report_resident_period
    ON report (resident_id, period_start) WHERE deleted_at IS NULL;


-- ─── 2) 데모 시드: 김순자(id=1) 지난주 월~금 notice 5건 ───────
-- 일별로 다양한 분포를 만들어 AI 가 한 주의 흐름을 잡을 수 있게 함:
--   월: GOOD/GOOD/FULL          (좋은 시작)
--   화: NORMAL/GOOD/LITTLE       (식사 적게)
--   수: NEEDS_OBSERVATION/ANXIOUS/NORMAL  (감정 약함)
--   목: GOOD/GOOD/FULL          (회복)
--   금: NORMAL/NORMAL/REFUSED    (식사 거부)
DO $$
DECLARE
    -- date_trunc('week', ...) = ISO 월요일. 거기서 7일 빼면 지난주 월요일.
    last_monday DATE := date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 days';
    existing    INT;
BEGIN
    SELECT COUNT(*) INTO existing
    FROM notice
    WHERE resident_id = 1
      AND sent_at::date BETWEEN last_monday AND last_monday + INTERVAL '4 days';

    IF existing > 0 THEN
        RAISE NOTICE '김순자 지난주 시드 이미 존재 (%건) — 시드 INSERT 건너뜀', existing;
        RETURN;
    END IF;

    -- ── 월요일 ──
    INSERT INTO notice (
        resident_id, author_id, root_notice_id, version,
        structured_status, participated_programs, raw_memo, tone,
        ai_generated_texts, selected_draft_index, is_refined,
        final_polished_text, status, is_edited, sent_at
    ) VALUES (
        1, 1, NULL, 1,
        '{"health":"GOOD","mood":"GOOD","meal":"FULL","medication":"DONE"}'::jsonb,
        '[{"program_id":1,"title":"인지치료","start_time":"10:00"}]'::jsonb,
        '오늘 컨디션 좋으심',
        'POLITE',
        '[{"index":0,"label":"A","text":"오늘 김순자 어르신께서는 컨디션이 매우 좋으셨습니다."},
          {"index":1,"label":"B","text":"오늘 어르신은 따뜻하고 평안한 하루를 보내셨습니다."},
          {"index":2,"label":"C","text":"오늘 어르신은 건강하게 하루를 보내셨습니다."}]'::jsonb,
        0, FALSE,
        '오늘 김순자 어르신께서는 컨디션이 매우 좋으셨습니다. 오전 인지치료에 즐겁게 참여하셨고, 점심도 깨끗이 비우셨습니다. 약도 시간 맞춰 잘 복용하셨습니다.',
        'SENT', FALSE,
        last_monday::timestamptz + INTERVAL '12 hours'
    );

    -- ── 화요일: 식사 적게 + 프로그램 2개 참여 ──
    INSERT INTO notice (
        resident_id, author_id, root_notice_id, version,
        structured_status, participated_programs, raw_memo, tone,
        ai_generated_texts, selected_draft_index, is_refined,
        final_polished_text, status, is_edited, sent_at
    ) VALUES (
        1, 1, NULL, 1,
        '{"health":"NORMAL","mood":"GOOD","meal":"LITTLE","medication":"DONE"}'::jsonb,
        '[{"program_id":1,"title":"인지치료","start_time":"10:00"},{"program_id":2,"title":"실버체조","start_time":"14:00"}]'::jsonb,
        '점심 미역국 반 그릇',
        'POLITE',
        '[{"index":0,"label":"A","text":"오늘 어르신은 활기차게 활동에 참여하셨습니다."},
          {"index":1,"label":"B","text":"오늘 어르신은 즐거운 시간을 보내셨습니다."},
          {"index":2,"label":"C","text":"오늘 어르신은 평온하게 지내셨습니다."}]'::jsonb,
        0, FALSE,
        '오늘 어르신께서는 기분 좋게 오전 인지치료와 오후 실버체조 모두 참여하셨습니다. 점심 식사량은 평소보다 다소 적으셨으나, 약은 잊지 않고 잘 챙겨 드셨습니다.',
        'SENT', FALSE,
        last_monday::timestamptz + INTERVAL '1 day 12 hours'
    );

    -- ── 수요일: 불안 + 관찰 필요 (감정 약함의 날) ──
    INSERT INTO notice (
        resident_id, author_id, root_notice_id, version,
        structured_status, participated_programs, raw_memo, tone,
        ai_generated_texts, selected_draft_index, is_refined,
        final_polished_text, status, is_edited, sent_at
    ) VALUES (
        1, 1, NULL, 1,
        '{"health":"NEEDS_OBSERVATION","mood":"ANXIOUS","meal":"NORMAL","medication":"DONE"}'::jsonb,
        '[]'::jsonb,
        '오전 다소 불안한 모습. 가족 보고 싶다 말씀하심',
        'EMPATHETIC',
        '[{"index":0,"label":"A","text":"오늘 어르신은 다소 차분하지 못한 모습이셨습니다."},
          {"index":1,"label":"B","text":"오늘 어르신을 좀 더 세심히 보살펴 드렸습니다."},
          {"index":2,"label":"C","text":"오늘 어르신은 가족이 그리우신 듯한 하루였습니다."}]'::jsonb,
        1, FALSE,
        '오늘 김순자 어르신께서는 오전에 다소 차분하지 못한 모습을 보이셨습니다. 가족이 그리우신 듯한 표정이셨고, 곁에서 따뜻하게 말동무해 드렸습니다. 점심 식사는 보통 정도로 드셨고, 약은 시간 맞춰 복용하셨습니다.',
        'SENT', FALSE,
        last_monday::timestamptz + INTERVAL '2 days 12 hours'
    );

    -- ── 목요일: 회복 ──
    INSERT INTO notice (
        resident_id, author_id, root_notice_id, version,
        structured_status, participated_programs, raw_memo, tone,
        ai_generated_texts, selected_draft_index, is_refined,
        final_polished_text, status, is_edited, sent_at
    ) VALUES (
        1, 1, NULL, 1,
        '{"health":"GOOD","mood":"GOOD","meal":"FULL","medication":"DONE"}'::jsonb,
        '[{"program_id":1,"title":"인지치료","start_time":"10:00"},{"program_id":3,"title":"미술활동","start_time":"16:00"}]'::jsonb,
        '컨디션 회복, 즐겁게 지내심',
        'POLITE',
        '[{"index":0,"label":"A","text":"오늘 어르신은 한결 안정된 모습이셨습니다."},
          {"index":1,"label":"B","text":"오늘 어르신은 따뜻하고 활기찬 하루를 보내셨습니다."},
          {"index":2,"label":"C","text":"오늘 어르신은 건강하게 즐기셨습니다."}]'::jsonb,
        0, FALSE,
        '오늘 어르신께서는 어제보다 한결 안정된 모습으로 하루를 보내셨습니다. 인지치료와 미술활동에 모두 참여하셨고, 식사도 완식하셨습니다.',
        'SENT', FALSE,
        last_monday::timestamptz + INTERVAL '3 days 12 hours'
    );

    -- ── 금요일: 식사 거부 (다시 약해진 날) ──
    INSERT INTO notice (
        resident_id, author_id, root_notice_id, version,
        structured_status, participated_programs, raw_memo, tone,
        ai_generated_texts, selected_draft_index, is_refined,
        final_polished_text, status, is_edited, sent_at
    ) VALUES (
        1, 1, NULL, 1,
        '{"health":"NORMAL","mood":"NORMAL","meal":"REFUSED","medication":"DONE"}'::jsonb,
        '[{"program_id":1,"title":"인지치료","start_time":"10:00"}]'::jsonb,
        '저녁 식사 거의 안 드심',
        'EMPATHETIC',
        '[{"index":0,"label":"A","text":"오늘 어르신은 저녁 식사를 잘 드시지 못하셨습니다."},
          {"index":1,"label":"B","text":"오늘 어르신을 좀 더 살펴드리고 있습니다."},
          {"index":2,"label":"C","text":"오늘 어르신께서 식사를 권하기 어려운 하루였습니다."}]'::jsonb,
        0, FALSE,
        '오늘 김순자 어르신께서는 저녁 식사를 잘 드시지 못하셨습니다. 평소보다 입맛이 없으신 듯하여, 내일은 좋아하시는 반찬으로 영양사와 상의해 준비하겠습니다.',
        'SENT', FALSE,
        last_monday::timestamptz + INTERVAL '4 days 12 hours'
    );

    RAISE NOTICE '김순자 지난주 시드 INSERT 완료: 5건 (% ~ %)',
                 last_monday, last_monday + INTERVAL '4 days';
END $$;

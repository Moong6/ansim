-- =============================================================
-- 케어알림장 (가칭) — init_db.sql
-- PostgreSQL 16 기준 / 4단계 ERD 반영
-- 실행: psql -h localhost -U postgres -d care_notice -f init_db.sql
-- 또는: docker exec -i care-postgres psql -U postgres -d care_notice < init_db.sql
--
-- 설계 원칙
--   1) JSONB 정형 저장 (structured_status, participated_programs, ai_generated_texts)
--   2) 데이터 4단 분리 (raw_memo -> ai_generated_texts -> selected_draft_index -> final_polished_text)
--   3) Soft delete (전 테이블 deleted_at) + Append-only 버전 관리 (Notice)
-- =============================================================

-- 재실행 가능하도록 기존 객체 정리 (개발 편의용. 운영에서는 절대 사용 금지)
DROP TABLE IF EXISTS notice CASCADE;
DROP TABLE IF EXISTS assignment CASCADE;
DROP TABLE IF EXISTS program CASCADE;
DROP TABLE IF EXISTS guardian CASCADE;
DROP TABLE IF EXISTS resident CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS facility CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS gender_type CASCADE;
DROP TYPE IF EXISTS notice_tone CASCADE;
DROP TYPE IF EXISTS notice_status CASCADE;

-- -------------------------------------------------------------
-- ENUM 타입 정의
-- -------------------------------------------------------------
CREATE TYPE user_role    AS ENUM ('CAREGIVER', 'SOCIAL_WORKER', 'ADMIN');
CREATE TYPE gender_type   AS ENUM ('M', 'F');
CREATE TYPE notice_tone   AS ENUM ('FRIENDLY', 'POLITE', 'EMPATHETIC');
CREATE TYPE notice_status AS ENUM ('DRAFT', 'SENT');

-- =============================================================
-- 1. Facility (시설)
-- =============================================================
CREATE TABLE facility (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    address     VARCHAR(255),
    phone       VARCHAR(20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =============================================================
-- 2. app_user (직원)  ※ user는 예약어라 app_user로 명명
-- =============================================================
CREATE TABLE app_user (
    id             BIGSERIAL PRIMARY KEY,
    facility_id    BIGINT NOT NULL REFERENCES facility(id),
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,   -- bcrypt 해시. 평문 저장 절대 금지
    name           VARCHAR(50)  NOT NULL,
    role           user_role    NOT NULL DEFAULT 'CAREGIVER',
    preferred_lang VARCHAR(10)  NOT NULL DEFAULT 'ko',   -- 2차: 메모 입력 기본 언어
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);
-- 활성 계정 내 이메일 유니크 (soft delete 고려한 부분 유니크 인덱스)
CREATE UNIQUE INDEX uq_app_user_email_active
    ON app_user (email) WHERE deleted_at IS NULL;

-- =============================================================
-- 3. Resident (어르신)
-- =============================================================
CREATE TABLE resident (
    id                 BIGSERIAL PRIMARY KEY,
    facility_id        BIGINT NOT NULL REFERENCES facility(id),
    name               VARCHAR(50) NOT NULL,
    birth_date         DATE,
    room_number        VARCHAR(20),
    care_level         VARCHAR(20),    -- 장기요양등급 (예: 1등급, 인지지원등급)
    precautions        TEXT,           -- 기저질환/주의사항. AI 프롬프트 System Context로 주입(할루시네이션 방지)
    profile_image_url  VARCHAR(500),
    gender             gender_type,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_resident_facility ON resident (facility_id) WHERE deleted_at IS NULL;

-- =============================================================
-- 4. Guardian (보호자)
-- =============================================================
CREATE TABLE guardian (
    id            BIGSERIAL PRIMARY KEY,
    resident_id   BIGINT NOT NULL REFERENCES resident(id),
    name          VARCHAR(50) NOT NULL,
    relationship  VARCHAR(20),
    phone         VARCHAR(20),     -- 추후 알림톡/SMS 발송 대상
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_guardian_resident ON guardian (resident_id) WHERE deleted_at IS NULL;

-- =============================================================
-- 5. Program (공통 프로그램)
-- =============================================================
CREATE TABLE program (
    id            BIGSERIAL PRIMARY KEY,
    facility_id   BIGINT NOT NULL REFERENCES facility(id),
    program_date  DATE NOT NULL,
    start_time    TIME,
    title         VARCHAR(100) NOT NULL,
    description   VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
-- 오늘 프로그램 조회 가속: GET /api/programs/today
CREATE INDEX idx_program_facility_date ON program (facility_id, program_date) WHERE deleted_at IS NULL;

-- =============================================================
-- 6. Assignment (직원-어르신 담당 매핑, N:M)
-- =============================================================
CREATE TABLE assignment (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES app_user(id),
    resident_id   BIGINT NOT NULL REFERENCES resident(id),
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
-- 중복 배정 방지 (활성 매핑 기준)
CREATE UNIQUE INDEX uq_assignment_active
    ON assignment (user_id, resident_id) WHERE deleted_at IS NULL;

-- =============================================================
-- 7. Notice (알림장) — 핵심 테이블
--    재전송은 UPDATE가 아니라 새 행 INSERT (append-only) + version +1
-- =============================================================
CREATE TABLE notice (
    id                     BIGSERIAL PRIMARY KEY,
    resident_id            BIGINT NOT NULL REFERENCES resident(id),
    author_id              BIGINT NOT NULL REFERENCES app_user(id),
    root_notice_id         BIGINT REFERENCES notice(id),   -- NULL이면 자신이 최초 버전
    version                INT NOT NULL DEFAULT 1,

    -- 정형 입력 (JSONB)
    structured_status      JSONB NOT NULL,                 -- {"health","mood","meal","medication"}
    participated_programs  JSONB NOT NULL DEFAULT '[]',    -- [{"program_id","title","start_time"}]

    -- 원본 메모
    raw_memo               TEXT,
    tone                   notice_tone NOT NULL DEFAULT 'POLITE',

    -- AI 생성 데이터 (4단 분리의 핵심)
    ai_generated_texts     JSONB NOT NULL,                 -- [{"index","label","text"}] 3초안 보존
    selected_draft_index   SMALLINT,                       -- 0/1/2 (A/B/C)
    is_refined             BOOLEAN NOT NULL DEFAULT FALSE,
    final_polished_text    TEXT,                           -- 최종 발송 본문 (UPDATE 절대 금지)

    -- 상태/이력
    status                 notice_status NOT NULL DEFAULT 'DRAFT',
    is_edited              BOOLEAN NOT NULL DEFAULT FALSE, -- 재전송본 여부 -> 보호자에 "수정됨" 표시
    sent_at                TIMESTAMPTZ,
    read_at                TIMESTAMPTZ,                    -- 보호자 읽음 시각 (발송 후 갱신되는 유일 예외)
    memo_lang              VARCHAR(10) NOT NULL DEFAULT 'ko',   -- 2차: 이 알림장 메모의 입력 언어

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ
);

-- 버전 이력/현재본 조회 가속 (요청된 복합 인덱스)
CREATE INDEX idx_notice_root_version ON notice (root_notice_id, version);
-- 카드 작성완료 판정: 오늘 이 어르신 SENT 알림장 존재?
CREATE INDEX idx_notice_resident_status ON notice (resident_id, status, deleted_at);
-- 정형 통계 쿼리 (예: 식사 거부 어르신 추출)
CREATE INDEX idx_notice_status_gin ON notice USING GIN (structured_status);

-- =============================================================
-- 8. Report (주간 안심 리포트) — 3차 스프린트
--    notice 와 데이터 구조가 달라 별도 테이블.
--    enum 은 notice_tone / notice_status 그대로 재사용.
-- =============================================================
CREATE TABLE report (
    id                BIGSERIAL PRIMARY KEY,
    resident_id       BIGINT NOT NULL REFERENCES resident(id),
    author_id         BIGINT NOT NULL REFERENCES app_user(id),
    period_start      DATE NOT NULL,                          -- 월요일
    period_end        DATE NOT NULL,                          -- 일요일
    recorded_days     SMALLINT NOT NULL,                      -- 0~7
    stats_summary     JSONB NOT NULL,                         -- 코드 집계 결과
    source_notice_ids JSONB NOT NULL DEFAULT '[]',            -- 근거 notice id 배열
    tone              notice_tone   NOT NULL DEFAULT 'POLITE',
    ai_generated_text TEXT,                                    -- AI 원본
    final_text        TEXT,                                    -- 직원 편집 최종본 (UPDATE 금지)
    status            notice_status NOT NULL DEFAULT 'DRAFT',
    sent_at           TIMESTAMPTZ,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_report_resident_period
    ON report (resident_id, period_start) WHERE deleted_at IS NULL;

-- =============================================================
-- 시드(Seed) 데이터 — MVP 검증용
-- =============================================================

-- [1] 시설
INSERT INTO facility (id, name, address, phone) VALUES
(1, '행복요양원', '서울시 강서구 행복로 12', '02-1234-5678');

-- [2] 직원 (3명)
-- ※ password_hash는 데모용 자리표시자입니다. 실제로는 bcrypt 해시로 교체하세요.
--    예) 백엔드에서 passlib로 'test1234'를 bcrypt 해싱한 값을 넣을 것.
INSERT INTO app_user (id, facility_id, email, password_hash, name, role) VALUES
(1, 1, 'minji@happy.kr',  '$2b$12$REPLACE_WITH_BCRYPT_HASH_OF_PASSWORD', '김민지', 'CAREGIVER'),
(2, 1, 'seojun@happy.kr', '$2b$12$REPLACE_WITH_BCRYPT_HASH_OF_PASSWORD', '박서준', 'SOCIAL_WORKER'),
(3, 1, 'admin@happy.kr',  '$2b$12$REPLACE_WITH_BCRYPT_HASH_OF_PASSWORD', '관리자', 'ADMIN');

-- [3] 어르신 (8명)
INSERT INTO resident (id, facility_id, name, birth_date, room_number, care_level, precautions, gender) VALUES
(1, 1, '김순자', '1943-03-11', '301호', '3등급', '당뇨, 경증 인지저하',   'F'),
(2, 1, '이복남', '1940-07-22', '302호', '2등급', '고혈압',                'F'),
(3, 1, '박정호', '1938-12-05', '303호', '1등급', '와상, 휠체어 사용',     'M'),
(4, 1, '최영자', '1945-01-30', '304호', '4등급', '무릎 관절염',           'F'),
(5, 1, '정달수', '1941-09-14', '305호', '2등급', '치매 초기',             'M'),
(6, 1, '한말례', '1939-05-08', '306호', '3등급', '청력 저하',             'F'),
(7, 1, '오금자', '1944-11-19', '307호', '5등급', '특이사항 없음',         'F'),
(8, 1, '윤상철', '1937-02-27', '308호', '1등급', '와상, 위루관',          'M');

-- [4] 보호자 (예시 3건)
INSERT INTO guardian (resident_id, name, relationship, phone) VALUES
(1, '김보람', '자녀', '010-1111-2222'),
(2, '이지원', '자녀', '010-3333-4444'),
(3, '박현우', '자녀', '010-5555-6666');

-- [5] 공통 프로그램 (오늘 날짜 기준 3건)
INSERT INTO program (facility_id, program_date, start_time, title, description) VALUES
(1, CURRENT_DATE, '10:00', '인지치료', '색칠하기 활동'),
(1, CURRENT_DATE, '14:00', '실버체조', '가벼운 스트레칭'),
(1, CURRENT_DATE, '16:00', '미술활동', '한지공예');

-- [6] 담당 매핑 — 김민지(user 1)가 어르신 1~8 전원 담당
INSERT INTO assignment (user_id, resident_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8);

-- [7] 알림장 재전송 이력 예시 (v1 -> v2, append-only)
-- v1 (최초 전송)
INSERT INTO notice (
    id, resident_id, author_id, root_notice_id, version,
    structured_status, participated_programs, raw_memo, tone,
    ai_generated_texts, selected_draft_index, is_refined, final_polished_text,
    status, is_edited, sent_at
) VALUES (
    101, 1, 1, NULL, 1,
    '{"health":"GOOD","mood":"GOOD","meal":"LITTLE","medication":"DONE"}',
    '[{"program_id":1,"title":"인지치료","start_time":"10:00"}]',
    '점심 미역국 절반, 컨디션 좋음, 손녀 얘기 많이 하심',
    'POLITE',
    '[{"index":0,"label":"A","text":"안녕하세요 보호자님. 오늘 김순자 어르신께서는 인지치료에 참여하시고 점심도 잘 드셨습니다."},{"index":1,"label":"B","text":"보호자님 안녕하세요. 어르신은 오늘 차분히 하루를 보내셨습니다."},{"index":2,"label":"C","text":"어르신께서 오늘 하루 편안하게 지내셨습니다."}]',
    0, TRUE,
    '안녕하세요 보호자님. 오늘 김순자 어르신께서는 오전 인지치료 활동에 참여하셨고, 점심으로 나온 미역국을 절반 정도 맛있게 드셨습니다. 컨디션이 좋으셔서 손녀분 이야기를 즐겁게 나누어 주셨습니다.',
    'SENT', FALSE, now() - INTERVAL '40 minutes'
);

-- v2 (오타 수정 후 재전송 — 새 행 INSERT, root는 101 참조)
INSERT INTO notice (
    id, resident_id, author_id, root_notice_id, version,
    structured_status, participated_programs, raw_memo, tone,
    ai_generated_texts, selected_draft_index, is_refined, final_polished_text,
    status, is_edited, sent_at
) VALUES (
    140, 1, 1, 101, 2,
    '{"health":"GOOD","mood":"GOOD","meal":"LITTLE","medication":"DONE"}',
    '[{"program_id":1,"title":"인지치료","start_time":"10:00"}]',
    '점심 미역국 절반, 컨디션 좋음, 손녀 얘기 많이 하심',
    'POLITE',
    '[{"index":0,"label":"A","text":"안녕하세요 보호자님. 오늘 김순자 어르신께서는 인지치료에 참여하시고 점심도 잘 드셨습니다."},{"index":1,"label":"B","text":"보호자님 안녕하세요. 어르신은 오늘 차분히 하루를 보내셨습니다."},{"index":2,"label":"C","text":"어르신께서 오늘 하루 편안하게 지내셨습니다."}]',
    0, FALSE,
    '안녕하세요 보호자님. 오늘 김순자 어르신께서는 오전 인지치료 활동에 참여하셨고, 점심으로 나온 미역국을 절반 정도 맛있게 드셨습니다. 컨디션이 좋으셔서 손녀분 이야기를 즐겁게 나누어 주셨습니다. (오타 교정본)',
    'SENT', TRUE, now() - INTERVAL '10 minutes'
);

-- 시퀀스 보정: 수동 id 입력 후 BIGSERIAL 다음 값을 맞춰줌
SELECT setval('facility_id_seq',  (SELECT MAX(id) FROM facility));
SELECT setval('app_user_id_seq',  (SELECT MAX(id) FROM app_user));
SELECT setval('resident_id_seq',  (SELECT MAX(id) FROM resident));
SELECT setval('notice_id_seq',    (SELECT MAX(id) FROM notice));

-- =============================================================
-- 확인용 쿼리 (실행 후 수동 점검)
-- =============================================================
-- SELECT name, room_number, care_level FROM resident ORDER BY id;
-- SELECT title, start_time FROM program WHERE program_date = CURRENT_DATE;
-- SELECT id, version, is_edited, status FROM notice WHERE COALESCE(root_notice_id, id) = 101 ORDER BY version;
-- 정형 통계 데모: 식사를 적게/거부한 알림장 추출
-- SELECT id, resident_id, structured_status->>'meal' AS meal
--   FROM notice WHERE structured_status->>'meal' IN ('LITTLE','REFUSED');

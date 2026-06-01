-- =============================================================
-- 2차 스프린트: 다국어 메모 입력 지원 (델타 마이그레이션)
-- 기존 데이터 보존. init_db.sql 재실행 금지.
--
-- 적용:
--   Get-Content app/db/migrations/002_multilingual.sql |
--     docker exec -i care-postgres psql -U postgres -d care_notice
--
-- 재실행 안전성: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING 사용
-- =============================================================

-- ─── 컬럼 2개 추가 ────────────────────────────────────────────
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS preferred_lang VARCHAR(10) NOT NULL DEFAULT 'ko';

ALTER TABLE notice
    ADD COLUMN IF NOT EXISTS memo_lang VARCHAR(10) NOT NULL DEFAULT 'ko';

-- ─── 시드: 베트남 직원 후엉 + 어르신 1~4 담당 ──────────────────
-- password_hash 는 'test1234' 의 bcrypt 해시 (다른 시드 계정과 동일)
INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang)
VALUES (
    1,
    'huong@happy.kr',
    '$2b$12$/dvF/A8WCV/46ST0j5a1A.gwgkfkrQwsP4RoyUCE/VPoHOqAh3/.O',
    '후엉',
    'CAREGIVER',
    'vi'
)
ON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO assignment (user_id, resident_id)
SELECT u.id, r.id
FROM app_user u CROSS JOIN resident r
WHERE u.email = 'huong@happy.kr'
  AND r.id IN (1, 2, 3, 4)
ON CONFLICT (user_id, resident_id) WHERE deleted_at IS NULL DO NOTHING;

-- ─── 확인 쿼리 (선택) ─────────────────────────────────────────
-- SELECT email, preferred_lang FROM app_user;
-- SELECT id, memo_lang FROM notice LIMIT 3;

-- =============================================================
-- 4차 스프린트: 공지사항 게시판
--   - 신규 테이블 1개: notice_board  (+ 부분 인덱스 1개)
--   - 기존 테이블 변경 없음
--   - 데모 시드: notice_board 5건 (author_id 1·2·3 분산)
--
-- 적용:
--   Get-Content app/db/migrations/004_notice_board.sql |
--     docker exec -i care-postgres psql -U postgres -d care_notice
--
-- 재실행 안전성:
--   CREATE TABLE / INDEX 는 IF NOT EXISTS, 시드는 기존 행 카운트로 가드
-- =============================================================

-- ─── 1) 신규 테이블 ───────────────────────────────────────────
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

-- 최신순 목록 조회 가속 + 소프트 삭제 제외 (활성 행만)
CREATE INDEX IF NOT EXISTS idx_notice_board_facility_recent
    ON notice_board (facility_id, created_at DESC)
    WHERE deleted_at IS NULL;


-- ─── 2) 데모 시드: author_id 1·2·3 분산 (권한 시연용) ────────
DO $$
DECLARE
    existing INT;
BEGIN
    SELECT COUNT(*) INTO existing FROM notice_board WHERE facility_id = 1;

    IF existing > 0 THEN
        RAISE NOTICE 'notice_board 시드 이미 존재 (%건) — INSERT 건너뜀', existing;
        RETURN;
    END IF;

    INSERT INTO notice_board (facility_id, author_id, title, content) VALUES
    (1, 2, '2026년 6월 행사 일정 안내',
     '다음 달 시설 행사 일정을 안내드립니다. 6월 1일 어버이날 특별 프로그램을 준비 중이오니 많은 관심 부탁드립니다.'),
    (1, 3, '감염병 예방 수칙 재안내',
     '환절기를 맞아 감염병 예방 수칙을 다시 한 번 안내드립니다. 손씻기 및 마스크 착용을 생활화해 주시기 바랍니다.'),
    (1, 2, '정기 회의 일정 변경',
     '이번 주 정기 회의가 수요일 오후 3시로 변경되었습니다. 참석 부탁드립니다.'),
    (1, 3, '신규 식자재 공급업체 변경',
     '4월부터 식자재 공급업체가 변경됩니다. 식단 운영에 참고 바랍니다. 품질 개선이 기대됩니다.'),
    (1, 1, '직원 휴가 신청 일정',
     '여름철 휴가 신청을 다음 주까지 받습니다. 희망 일정을 담당자에게 제출해 주시기 바랍니다.');

    RAISE NOTICE 'notice_board 시드 INSERT 완료: 5건';
END $$;

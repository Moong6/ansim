-- 기존 유저/어르신/보호자/담당 데이터 초기화 후 한국어 시드 재삽입
-- guardian은 user_id FK 가지므로 먼저 삭제

BEGIN;

-- 1. 기존 데이터 정리 (CASCADE로 참조 테이블 포함)
TRUNCATE guardian CASCADE;
TRUNCATE assignment CASCADE;
TRUNCATE app_user CASCADE;
TRUNCATE resident CASCADE;

-- 2. 시설 확인 (이미 존재해야 함)
-- facility id=1이 없으면 삽입
INSERT INTO facility (id, name, address, phone) VALUES
(1, '행복한 요양원', '서울 종로구 혜화동 123', '02-1234-5678')
ON CONFLICT (id) DO UPDATE SET name = '행복한 요양원', address = '서울 종로구 혜화동 123';

-- 3. 어르신 (resident)
INSERT INTO resident (id, facility_id, name, room_number, care_level, birth_date, gender, precautions) VALUES
(1, 1, '김순자', '101', '3등급', '1940-03-15', 'F', '고혈압 약 복용 중, 당뇨 주의'),
(2, 1, '이복남', '102', '2등급', '1938-07-22', 'M', '경도 치매, 보행 시 보조 필요'),
(3, 1, '박정호', '201', '1등급', '1935-11-08', 'M', '와상 환자, 휠체어 사용 필수, 위루관 영양, 스스로 걷거나 서는 것 불가능')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  room_number = EXCLUDED.room_number,
  care_level = EXCLUDED.care_level,
  birth_date = EXCLUDED.birth_date,
  gender = EXCLUDED.gender,
  precautions = EXCLUDED.precautions;

-- 시퀀스 리셋
SELECT setval('resident_id_seq', (SELECT MAX(id) FROM resident));

-- 4. 직원 (app_user) - 비밀번호: test1234
-- bcrypt hash for 'test1234': $2b$12$LJ3m4ys3GZzkmvCgSz7WCuBqdPGNOZMPxqPdaFJwfSsT4sKBLwHhS
INSERT INTO app_user (id, facility_id, email, password_hash, name, role, preferred_lang) VALUES
(1, 1, 'minji@happy.kr',  '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '김민지', 'CAREGIVER', 'ko'),
(2, 1, 'seojun@happy.kr', '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '박서준', 'SOCIAL_WORKER', 'ko'),
(3, 1, 'admin@happy.kr',  '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '관리자', 'ADMIN', 'ko'),
(4, 1, 'huong@happy.kr',  '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '후엉',   'CAREGIVER', 'vi'),
(5, 1, 'boram@family.kr', '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '김보람', 'GUARDIAN', 'ko'),
(6, 1, 'jiwon@family.kr', '$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '이지원', 'GUARDIAN', 'ko'),
(7, 1, 'hyeonu@family.kr','$2b$12$65AyzpZl.JfWz.J5WxU/buDjoOQZB7vGXVWl2PyPTe6Ea3ZnDGcKK', '박현우', 'GUARDIAN', 'ko')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  preferred_lang = EXCLUDED.preferred_lang;

SELECT setval('app_user_id_seq', (SELECT MAX(id) FROM app_user));

-- 5. 담당 배정 (assignment)
INSERT INTO assignment (caregiver_id, resident_id) VALUES
(1, 1),  -- 김민지 → 김순자
(1, 2),  -- 김민지 → 이복남
(1, 3),  -- 김민지 → 박정호
(2, 1),  -- 박서준 → 김순자
(4, 2),  -- 후엉 → 이복남
(4, 3)   -- 후엉 → 박정호
ON CONFLICT DO NOTHING;

-- 6. 보호자 연결 (guardian)
INSERT INTO guardian (resident_id, user_id, name, relationship, phone) VALUES
(1, 5, '김보람', '자녀', '010-1111-2222'),  -- 김순자 ← 김보람
(2, 6, '이지원', '자녀', '010-3333-4444'),  -- 이복남 ← 이지원
(3, 7, '박현우', '자녀', '010-5555-6666')   -- 박정호 ← 박현우
ON CONFLICT DO NOTHING;

COMMIT;

"""
Render 배포용 DB 자동 초기화
- ENUM 타입 생성 (각 구문 개별 실행 — psycopg v3 호환)
- 모든 테이블 생성 (IF NOT EXISTS)
- facility 테이블이 비어 있으면 기본 시드 데이터 투입
"""

import bcrypt
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import Base, SessionLocal, engine

# 모든 모델을 Base.metadata에 등록하기 위해 import
from app.models.models import (  # noqa: F401
    AppUser, Assignment, Facility, Guardian, Notice, Program, Resident,
)
from app.models.report import Report  # noqa: F401
from app.models.board import NoticeBoard  # noqa: F401
from app.models.inquiry import Inquiry, InquiryAnswer  # noqa: F401
from app.models.meal_schedule import MealLog, ScheduleEvent  # noqa: F401
from app.models.album import Album, album_resident_table  # noqa: F401


# ─── ENUM 정의 (각각 개별 실행해야 psycopg v3에서 동작) ──────────────────────────

_ENUM_STMTS = [
    "DO $$ BEGIN CREATE TYPE user_role AS ENUM ('CAREGIVER','SOCIAL_WORKER','ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE gender_type AS ENUM ('M','F'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE notice_tone AS ENUM ('FRIENDLY','POLITE','EMPATHETIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE notice_status AS ENUM ('DRAFT','SENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE inquiry_category AS ENUM ('HEALTH','ADMIN_AFFAIRS','VISIT','MEAL','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE inquiry_status AS ENUM ('UNREAD','READ','ANSWERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE classification_status AS ENUM ('SUCCESS','THRESHOLD_FALLBACK','LLM_ERROR_FALLBACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE meal_type AS ENUM ('BREAKFAST','LUNCH','DINNER','SNACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
    "DO $$ BEGIN CREATE TYPE schedule_event_type AS ENUM ('FACILITY_EVENT','BIRTHDAY','HOLIDAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
]


def init_db() -> None:
    """앱 시작 시 호출 — 스키마 보장 + 최초 1회 시드"""
    print("[startup] DB 초기화 시작...")

    # 1. ENUM 타입 생성 (구문별 개별 실행)
    with engine.connect() as conn:
        for stmt in _ENUM_STMTS:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"[startup] ENUM 생성 스킵 (이미 존재): {e}")
        conn.commit()

    # 2. GUARDIAN 값 추가 (autocommit 필요 — ALTER TYPE ADD VALUE 제약)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GUARDIAN'"))
            conn.commit()
        except Exception as e:
            print(f"[startup] GUARDIAN 추가 스킵: {e}")

    # 3. 테이블 생성 (이미 있으면 스킵)
    try:
        Base.metadata.create_all(engine, checkfirst=True)
        print("[startup] 테이블 생성 완료")
    except Exception as e:
        print(f"[startup] 테이블 생성 오류: {e}")
        raise

    # 4. 이전 배포에서 누락됐을 수 있는 컬럼 보정 (idempotent)
    _apply_column_patches()

    # 5. 기본 시드 (사용자·어르신) 투입
    db: Session = SessionLocal()
    try:
        count = db.execute(text("SELECT COUNT(*) FROM facility")).scalar_one()
        if count == 0:
            print("[startup] 기본 시드 데이터 투입 시작...")
            _seed_basic(db)
        else:
            print(f"[startup] 기본 시드 스킵 (facility {count}건 존재)")
    except Exception as e:
        print(f"[startup] 시드 오류: {e}")
    finally:
        db.close()

    # 6. 데모 콘텐츠 로드 (알림장·리포트·식단 등) — notice 테이블이 비어 있을 때만
    _load_demo_data_if_empty()

    print("[startup] DB 초기화 완료")


# ─── 컬럼 패치 (이전 배포에서 부분 생성된 테이블 보정) ─────────────────────────────

def _apply_column_patches() -> None:
    """이전 배포에서 누락됐을 수 있는 컬럼을 ADD IF NOT EXISTS로 보정"""
    patches = [
        "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS preferred_lang VARCHAR(10) NOT NULL DEFAULT 'ko'",
        "ALTER TABLE notice ADD COLUMN IF NOT EXISTS memo_lang VARCHAR(10) NOT NULL DEFAULT 'ko'",
        "ALTER TABLE guardian ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES app_user(id)",
        "ALTER TABLE inquiry ADD COLUMN IF NOT EXISTS answer_read_at TIMESTAMPTZ",
    ]
    with engine.connect() as conn:
        for stmt in patches:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"[startup] 컬럼 패치 스킵: {e}")
        conn.commit()
    print("[startup] 컬럼 패치 완료")


# ─── 기본 시드 ────────────────────────────────────────────────────────────────

def _seed_basic(db: Session) -> None:
    pw = bcrypt.hashpw(b"test1234", bcrypt.gensalt(12)).decode()

    # 시설
    db.execute(text(
        "INSERT INTO facility (name, address, phone) "
        "VALUES ('행복요양원', '서울시 강서구 행복로 12', '02-1234-5678')"
    ))
    db.flush()

    # 직원 (4명) — 파라미터 바인딩으로 인코딩 문제 방지
    staff = [
        {"email": "minji@happy.kr",  "name": "김민지", "role": "CAREGIVER",     "lang": "ko"},
        {"email": "seojun@happy.kr", "name": "박서준", "role": "SOCIAL_WORKER", "lang": "ko"},
        {"email": "admin@happy.kr",  "name": "관리자", "role": "ADMIN",         "lang": "ko"},
        {"email": "huong@happy.kr",  "name": "후엉",   "role": "CAREGIVER",     "lang": "vi"},
    ]
    for s in staff:
        db.execute(text(
            "INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang) "
            "VALUES (1, :email, :pw, :name, CAST(:role AS user_role), :lang)"
        ), {"email": s["email"], "pw": pw, "name": s["name"], "role": s["role"], "lang": s["lang"]})
    db.flush()

    # 어르신 (8명)
    residents = [
        {"name": "김순자", "birth": "1943-03-11", "room": "301호", "level": "3등급", "notes": "당뇨, 경증 인지저하", "gender": "F"},
        {"name": "이복남", "birth": "1940-07-22", "room": "302호", "level": "2등급", "notes": "고혈압",             "gender": "F"},
        {"name": "박정호", "birth": "1938-12-05", "room": "303호", "level": "1등급", "notes": "와상, 휠체어 사용", "gender": "M"},
        {"name": "최영자", "birth": "1945-01-30", "room": "304호", "level": "4등급", "notes": "무릎 관절염",        "gender": "F"},
        {"name": "정달수", "birth": "1941-09-14", "room": "305호", "level": "2등급", "notes": "치매 초기",          "gender": "M"},
        {"name": "한말례", "birth": "1939-05-08", "room": "306호", "level": "3등급", "notes": "청력 저하",          "gender": "F"},
        {"name": "오금자", "birth": "1944-11-19", "room": "307호", "level": "5등급", "notes": "특이사항 없음",      "gender": "F"},
        {"name": "윤상철", "birth": "1937-02-27", "room": "308호", "level": "1등급", "notes": "와상, 위루관",       "gender": "M"},
    ]
    for r in residents:
        db.execute(text(
            "INSERT INTO resident (facility_id, name, birth_date, room_number, care_level, precautions, gender) "
            "VALUES (1, :name, :birth, :room, :level, :notes, CAST(:gender AS gender_type))"
        ), r)
    db.flush()

    # 담당 배정 (전 직원 → 전 어르신)
    db.execute(text(
        "INSERT INTO assignment (user_id, resident_id) "
        "SELECT u.id, r.id FROM app_user u CROSS JOIN resident r "
        "WHERE u.role != CAST('GUARDIAN' AS user_role)"
    ))

    # 보호자 계정 + guardian 연결
    guardians = [
        {"email": "boram@family.kr",  "name": "김보람", "res": "김순자", "rel": "자녀"},
        {"email": "jiwon@family.kr",  "name": "이지원", "res": "이복남", "rel": "자녀"},
        {"email": "hyeonu@family.kr", "name": "박현우", "res": "박정호", "rel": "자녀"},
    ]
    for g in guardians:
        db.execute(text(
            "INSERT INTO app_user (facility_id, email, password_hash, name, role) "
            "VALUES (1, :email, :pw, :name, CAST('GUARDIAN' AS user_role))"
        ), {"email": g["email"], "pw": pw, "name": g["name"]})
        db.execute(text(
            "INSERT INTO guardian (resident_id, name, relationship, user_id) "
            "SELECT r.id, :name, :rel, "
            "  (SELECT id FROM app_user WHERE email = :email) "
            "FROM resident r WHERE r.name = :res"
        ), {"name": g["name"], "rel": g["rel"], "email": g["email"], "res": g["res"]})

    db.commit()
    print("[startup] 기본 시드 데이터 투입 완료")


# ─── 데모 콘텐츠 로드 ──────────────────────────────────────────────────────────

def _load_demo_data_if_empty() -> None:
    """meal_log 최신 날짜가 2026-06-02 미만이면 demo_data.sql 전체 reload"""
    from pathlib import Path
    from datetime import date

    db: Session = SessionLocal()
    try:
        max_date = db.execute(text("SELECT MAX(meal_date) FROM meal_log")).scalar_one()
        if max_date and max_date >= date(2026, 6, 2):
            print(f"[startup] 데모 데이터 최신 (meal_log max={max_date}) — 스킵")
            return
        print(f"[startup] 데모 데이터 갱신 필요 (meal_log max={max_date}) — reload")
    except Exception as e:
        print(f"[startup] 날짜 체크 오류: {e}")
    finally:
        db.close()

    sql_path = Path(__file__).parent / "demo_data.sql"
    if not sql_path.exists():
        print("[startup] demo_data.sql 없음 — 데모 데이터 스킵")
        return

    print("[startup] 데모 데이터 로드 시작...")
    sql_text = sql_path.read_text(encoding="utf-8")

    # 줄 단위로 구문 조립 (주석 제외, 여러 줄에 걸친 TRUNCATE 등 처리)
    stmts: list[str] = []
    buf = ""
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue  # 빈 줄·주석 스킵
        buf = (buf + " " + stripped).strip() if buf else stripped
        if buf.endswith(";"):
            stmts.append(buf)
            buf = ""
    if buf:
        stmts.append(buf)

    errors = 0
    with engine.connect() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                errors += 1
                conn.rollback()  # 실패한 트랜잭션 롤백 후 다음 구문 계속
                if errors <= 3:
                    print(f"[startup] 데모 구문 오류: {str(e)[:100]}")
        conn.commit()

    print(f"[startup] 데모 데이터 로드 완료 (총 {len(stmts)}개 구문, 오류 {errors}개)")

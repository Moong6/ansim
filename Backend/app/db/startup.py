"""
Render 배포용 DB 자동 초기화
- ENUM 타입 생성 (중복 무시)
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


# ─── ENUM 생성 SQL (idempotent) ────────────────────────────────────────────────

_ENUM_SQL = """
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('CAREGIVER','SOCIAL_WORKER','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE gender_type AS ENUM ('M','F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notice_tone AS ENUM ('FRIENDLY','POLITE','EMPATHETIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notice_status AS ENUM ('DRAFT','SENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE inquiry_category AS ENUM ('HEALTH','ADMIN_AFFAIRS','VISIT','MEAL','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE inquiry_status AS ENUM ('UNREAD','READ','ANSWERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE classification_status AS ENUM ('SUCCESS','THRESHOLD_FALLBACK','LLM_ERROR_FALLBACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE meal_type AS ENUM ('BREAKFAST','LUNCH','DINNER','SNACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE schedule_event_type AS ENUM ('FACILITY_EVENT','BIRTHDAY','HOLIDAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GUARDIAN';
"""


def init_db() -> None:
    """앱 시작 시 호출 — 스키마 보장 + 최초 1회 시드"""
    # 1. ENUM 생성
    with engine.connect() as conn:
        conn.execute(text(_ENUM_SQL))
        conn.commit()

    # 2. 테이블 생성 (이미 있으면 스킵)
    Base.metadata.create_all(engine, checkfirst=True)

    # 3. 비어 있으면 시드 투입
    db: Session = SessionLocal()
    try:
        count = db.execute(text("SELECT COUNT(*) FROM facility")).scalar_one()
        if count == 0:
            _seed_basic(db)
    finally:
        db.close()


# ─── 기본 시드 (시설 / 직원 / 어르신 / 보호자) ───────────────────────────────────

def _seed_basic(db: Session) -> None:
    pw = bcrypt.hashpw(b"test1234", bcrypt.gensalt(12)).decode()

    # 시설
    db.execute(text(
        "INSERT INTO facility (name, address, phone) "
        "VALUES ('행복요양원', '서울시 강서구 행복로 12', '02-1234-5678')"
    ))
    db.flush()

    # 직원 (4명)
    staff = [
        ("minji@happy.kr",   "김민지", "CAREGIVER",     "ko"),
        ("seojun@happy.kr",  "박서준", "SOCIAL_WORKER", "ko"),
        ("admin@happy.kr",   "관리자", "ADMIN",         "ko"),
        ("huong@happy.kr",   "후엉",   "CAREGIVER",     "vi"),
    ]
    for email, name, role, lang in staff:
        db.execute(text(
            "INSERT INTO app_user (facility_id, email, password_hash, name, role, preferred_lang) "
            f"VALUES (1, '{email}', '{pw}', '{name}', '{role}', '{lang}')"
        ))
    db.flush()

    # 어르신 (8명)
    residents = [
        ("김순자", "1943-03-11", "301호", "3등급", "당뇨, 경증 인지저하", "F"),
        ("이복남", "1940-07-22", "302호", "2등급", "고혈압", "F"),
        ("박정호", "1938-12-05", "303호", "1등급", "와상, 휠체어 사용", "M"),
        ("최영자", "1945-01-30", "304호", "4등급", "무릎 관절염", "F"),
        ("정달수", "1941-09-14", "305호", "2등급", "치매 초기", "M"),
        ("한말례", "1939-05-08", "306호", "3등급", "청력 저하", "F"),
        ("오금자", "1944-11-19", "307호", "5등급", "특이사항 없음", "F"),
        ("윤상철", "1937-02-27", "308호", "1등급", "와상, 위루관", "M"),
    ]
    for name, bdate, room, level, precautions, gender in residents:
        db.execute(text(
            "INSERT INTO resident (facility_id, name, birth_date, room_number, care_level, precautions, gender) "
            f"VALUES (1, '{name}', '{bdate}', '{room}', '{level}', '{precautions}', '{gender}')"
        ))
    db.flush()

    # 전 직원 → 전 어르신 담당 배정
    db.execute(text(
        "INSERT INTO assignment (user_id, resident_id) "
        "SELECT u.id, r.id FROM app_user u CROSS JOIN resident r "
        "WHERE u.role != 'GUARDIAN'"
    ))

    # 보호자 계정 + guardian 연결
    guardians = [
        ("boram@family.kr",  "김보람", "김순자", "자녀"),
        ("jiwon@family.kr",  "이지원", "이복남", "자녀"),
        ("hyeonu@family.kr", "박현우", "박정호", "자녀"),
    ]
    for email, name, resident_name, rel in guardians:
        db.execute(text(
            "INSERT INTO app_user (facility_id, email, password_hash, name, role) "
            f"VALUES (1, '{email}', '{pw}', '{name}', 'GUARDIAN')"
        ))
        db.execute(text(
            "INSERT INTO guardian (resident_id, name, relationship, user_id) "
            f"SELECT r.id, '{name}', '{rel}', (SELECT id FROM app_user WHERE email='{email}') "
            f"FROM resident r WHERE r.name='{resident_name}'"
        ))

    db.commit()
    print("[startup] 기본 시드 데이터 투입 완료")

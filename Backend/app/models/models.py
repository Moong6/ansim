"""
SQLAlchemy 2.0 ORM 모델 — 핸드오프 문서 4단계 ERD 반영
테이블명: facility / app_user / resident / guardian / program / assignment / notice
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship
from sqlalchemy.sql import func

from app.db.session import Base


# ─── ENUM 정의 (PostgreSQL native ENUM과 이름 일치) ──────────────────────────

class UserRole(str, enum.Enum):
    CAREGIVER     = "CAREGIVER"
    SOCIAL_WORKER = "SOCIAL_WORKER"
    ADMIN         = "ADMIN"
    GUARDIAN      = "GUARDIAN"


class GenderType(str, enum.Enum):
    M = "M"
    F = "F"


class NoticeTone(str, enum.Enum):
    FRIENDLY   = "FRIENDLY"
    POLITE     = "POLITE"
    EMPATHETIC = "EMPATHETIC"


class NoticeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT  = "SENT"


# ─── 공통 timestamp 컬럼 mixin ────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# =============================================================================
# 1. Facility
# =============================================================================

class Facility(TimestampMixin, Base):
    __tablename__ = "facility"

    id:      Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name:    Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    phone:   Mapped[str | None] = mapped_column(String(20))

    users:     Mapped[list["AppUser"]]  = orm_relationship(back_populates="facility")
    residents: Mapped[list["Resident"]] = orm_relationship(back_populates="facility")
    programs:  Mapped[list["Program"]]  = orm_relationship(back_populates="facility")


# =============================================================================
# 2. AppUser  ※ PostgreSQL 예약어 'user' 회피
# =============================================================================

class AppUser(TimestampMixin, Base):
    __tablename__ = "app_user"

    id:            Mapped[int]     = mapped_column(BigInteger, primary_key=True)
    facility_id:   Mapped[int]     = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    email:         Mapped[str]     = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str]     = mapped_column(String(255), nullable=False)
    name:          Mapped[str]     = mapped_column(String(50), nullable=False)
    role:          Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=False), nullable=False
    )
    # 2차 스프린트: 직원 기본 메모 입력 언어 (ko/vi/zh/en)
    preferred_lang: Mapped[str] = mapped_column(
        String(10), nullable=False, default="ko", server_default="ko"
    )

    facility:    Mapped["Facility"]         = orm_relationship(back_populates="users")
    assignments: Mapped[list["Assignment"]] = orm_relationship(back_populates="user")
    notices:     Mapped[list["Notice"]]     = orm_relationship(back_populates="author")


# =============================================================================
# 3. Resident
# =============================================================================

class Resident(TimestampMixin, Base):
    __tablename__ = "resident"

    id:                Mapped[int]          = mapped_column(BigInteger, primary_key=True)
    facility_id:       Mapped[int]          = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    name:              Mapped[str]          = mapped_column(String(50), nullable=False)
    birth_date:        Mapped[datetime | None] = mapped_column(Date)
    room_number:       Mapped[str | None]   = mapped_column(String(20))
    care_level:        Mapped[str | None]   = mapped_column(String(20))
    precautions:       Mapped[str | None]   = mapped_column(Text)   # AI 프롬프트에 주입
    profile_image_url: Mapped[str | None]   = mapped_column(String(500))
    gender:            Mapped[GenderType | None] = mapped_column(
        Enum(GenderType, name="gender_type", create_type=False)
    )

    facility:    Mapped["Facility"]         = orm_relationship(back_populates="residents")
    guardians:   Mapped[list["Guardian"]]   = orm_relationship(back_populates="resident")
    assignments: Mapped[list["Assignment"]] = orm_relationship(back_populates="resident")
    notices:     Mapped[list["Notice"]]     = orm_relationship(back_populates="resident")


# =============================================================================
# 4. Guardian
# =============================================================================

class Guardian(TimestampMixin, Base):
    __tablename__ = "guardian"

    id:           Mapped[int]      = mapped_column(BigInteger, primary_key=True)
    resident_id:  Mapped[int]      = mapped_column(BigInteger, ForeignKey("resident.id"), nullable=False)
    name:         Mapped[str]      = mapped_column(String(50), nullable=False)
    relationship: Mapped[str | None] = mapped_column(String(20))
    phone:        Mapped[str | None] = mapped_column(String(20))
    # 5차 스프린트: 보호자 app_user 계정 연결 (nullable — 1차 시드 호환)
    user_id:      Mapped[int | None] = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=True)

    resident: Mapped["Resident"] = orm_relationship(back_populates="guardians")


# =============================================================================
# 5. Program
# =============================================================================

class Program(TimestampMixin, Base):
    __tablename__ = "program"

    id:           Mapped[int]      = mapped_column(BigInteger, primary_key=True)
    facility_id:  Mapped[int]      = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    program_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    start_time:   Mapped[datetime | None] = mapped_column(Time)
    title:        Mapped[str]      = mapped_column(String(100), nullable=False)
    description:  Mapped[str | None] = mapped_column(String(255))

    facility: Mapped["Facility"] = orm_relationship(back_populates="programs")


# =============================================================================
# 6. Assignment  (직원 ↔ 어르신 N:M 매핑)
# =============================================================================

class Assignment(TimestampMixin, Base):
    __tablename__ = "assignment"

    id:          Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id:     Mapped[int] = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    resident_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("resident.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user:     Mapped["AppUser"]  = orm_relationship(back_populates="assignments")
    resident: Mapped["Resident"] = orm_relationship(back_populates="assignments")


# =============================================================================
# 7. Notice  ─ 핵심 테이블, Append-only 버전 관리
# =============================================================================

class Notice(TimestampMixin, Base):
    __tablename__ = "notice"

    id:             Mapped[int] = mapped_column(BigInteger, primary_key=True)
    resident_id:    Mapped[int] = mapped_column(BigInteger, ForeignKey("resident.id"), nullable=False)
    author_id:      Mapped[int] = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    root_notice_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("notice.id"))
    version:        Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # 정형 입력 (JSONB)
    structured_status:     Mapped[dict] = mapped_column(JSONB, nullable=False)
    participated_programs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # 원본 메모
    raw_memo: Mapped[str | None] = mapped_column(Text)
    tone:     Mapped[NoticeTone] = mapped_column(
        Enum(NoticeTone, name="notice_tone", create_type=False),
        nullable=False,
        default=NoticeTone.POLITE,
    )

    # AI 4단 분리
    ai_generated_texts:   Mapped[list]      = mapped_column(JSONB, nullable=False)
    selected_draft_index: Mapped[int | None] = mapped_column(SmallInteger)
    is_refined:           Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    final_polished_text:  Mapped[str | None] = mapped_column(Text)   # UPDATE 절대 금지

    # 상태
    status:    Mapped[NoticeStatus] = mapped_column(
        Enum(NoticeStatus, name="notice_status", create_type=False),
        nullable=False,
        default=NoticeStatus.DRAFT,
    )
    is_edited: Mapped[bool]          = mapped_column(Boolean, nullable=False, default=False)
    sent_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 유일 허용 UPDATE

    # 2차 스프린트: 이 알림장 메모의 입력 언어 (검증 로그용)
    memo_lang: Mapped[str] = mapped_column(
        String(10), nullable=False, default="ko", server_default="ko"
    )

    resident: Mapped["Resident"] = orm_relationship(back_populates="notices")
    author:   Mapped["AppUser"]  = orm_relationship(back_populates="notices")

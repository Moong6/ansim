"""
6차 스프린트: 식단표 + 일정표 ORM 모델
테이블명: meal_log, schedule_event
"""

import enum
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from sqlalchemy.sql import func

from app.db.session import Base


# ─── ENUM ───────────────────────────────────────────────────────────────────

class MealType(str, enum.Enum):
    BREAKFAST = "BREAKFAST"
    LUNCH     = "LUNCH"
    DINNER    = "DINNER"
    SNACK     = "SNACK"


class ScheduleEventType(str, enum.Enum):
    FACILITY_EVENT = "FACILITY_EVENT"
    BIRTHDAY       = "BIRTHDAY"
    HOLIDAY        = "HOLIDAY"


# ─── meal_log ───────────────────────────────────────────────────────────────

class MealLog(Base):
    __tablename__ = "meal_log"

    id          : Mapped[int]            = mapped_column(BigInteger, primary_key=True)
    facility_id : Mapped[int]            = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    author_id   : Mapped[int]            = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    meal_date   : Mapped[date]           = mapped_column(Date, nullable=False)
    meal_type   : Mapped[MealType]       = mapped_column(
        Enum(MealType, name="meal_type", create_type=False), nullable=False
    )
    menu_text   : Mapped[str]            = mapped_column(Text, nullable=False)
    photos      : Mapped[list]           = mapped_column(JSONB, nullable=False, default=list)
    created_at  : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at  : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped["AppUser"] = orm_relationship(foreign_keys=[author_id])  # type: ignore[name-defined]


# ─── schedule_event ─────────────────────────────────────────────────────────

class ScheduleEvent(Base):
    __tablename__ = "schedule_event"

    id          : Mapped[int]                 = mapped_column(BigInteger, primary_key=True)
    facility_id : Mapped[int]                 = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    author_id   : Mapped[int | None]          = mapped_column(BigInteger, ForeignKey("app_user.id"))
    event_date  : Mapped[date]                = mapped_column(Date, nullable=False)
    event_type  : Mapped[ScheduleEventType]   = mapped_column(
        Enum(ScheduleEventType, name="schedule_event_type", create_type=False), nullable=False
    )
    title       : Mapped[str]                 = mapped_column(String(100), nullable=False)
    description : Mapped[str | None]          = mapped_column(Text)
    resident_id : Mapped[int | None]          = mapped_column(BigInteger, ForeignKey("resident.id"))
    created_at  : Mapped[datetime]            = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  : Mapped[datetime]            = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at  : Mapped[datetime | None]     = mapped_column(DateTime(timezone=True))

    author  : Mapped["AppUser | None"]  = orm_relationship(foreign_keys=[author_id])   # type: ignore[name-defined]
    resident: Mapped["Resident | None"] = orm_relationship(foreign_keys=[resident_id])  # type: ignore[name-defined]

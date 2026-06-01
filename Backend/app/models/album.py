"""
7차 스프린트: 앨범 ORM 모델

테이블:
  album          — 활동(앨범) 단위, 사진 N장 (최대 10)
  album_resident — 활동 ↔ 어르신 N:M 매핑 (복합 PK)
"""

from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from sqlalchemy.sql import func

from app.db.session import Base


# ─── N:M 매핑 테이블 ──────────────────────────────────────────────────────────

album_resident_table = Table(
    "album_resident",
    Base.metadata,
    Column("album_id",    BigInteger, ForeignKey("album.id", ondelete="CASCADE"), primary_key=True),
    Column("resident_id", BigInteger, ForeignKey("resident.id"), primary_key=True),
    Column("created_at",  DateTime(timezone=True), server_default=func.now(), nullable=False),
)


# ─── album ────────────────────────────────────────────────────────────────────

class Album(Base):
    __tablename__ = "album"

    id           : Mapped[int]            = mapped_column(BigInteger, primary_key=True)
    facility_id  : Mapped[int]            = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    author_id    : Mapped[int]            = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    activity_date: Mapped[datetime]       = mapped_column(DateTime(timezone=False), nullable=False)
    title        : Mapped[str]            = mapped_column(String(100), nullable=False)
    description  : Mapped[str | None]     = mapped_column(Text)
    photos       : Mapped[list]           = mapped_column(JSONB, nullable=False, default=list, server_default="'[]'")
    created_at   : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at   : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped["AppUser"] = orm_relationship(  # type: ignore[name-defined]
        foreign_keys=[author_id]
    )
    residents: Mapped[list["Resident"]] = orm_relationship(  # type: ignore[name-defined]
        secondary=album_resident_table,
        lazy="selectin",
    )

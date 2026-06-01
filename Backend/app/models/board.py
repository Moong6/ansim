"""
4차 스프린트: 공지사항 게시판 ORM 모델

- 테이블명 notice_board: 1차 notice(일간 알림장)와 이름 충돌 회피
- 버전 관리 없음: 공지는 단순 UPDATE (AI 산출물 아님)
- soft delete(deleted_at) / facility_id 격리는 1차 패턴 그대로
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship
from sqlalchemy.sql import func

from app.db.session import Base
from app.models.models import AppUser, Facility  # noqa: F401


class NoticeBoard(Base):
    __tablename__ = "notice_board"

    id:          Mapped[int] = mapped_column(BigInteger, primary_key=True)
    facility_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    author_id:   Mapped[int] = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    title:       Mapped[str] = mapped_column(String(200), nullable=False)
    content:     Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    facility: Mapped["Facility"] = orm_relationship("Facility", lazy="select")
    author:   Mapped["AppUser"]  = orm_relationship("AppUser",  lazy="select")

"""
5차 스프린트: 보호자 문의 + AI 분류 모델
8차 스프린트: InquiryAnswer 모델 + InquiryStatus.ANSWERED 추가
"""

import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from sqlalchemy.sql import func

from app.db.session import Base
from app.models.models import TimestampMixin


class InquiryCategory(str, enum.Enum):
    HEALTH         = "HEALTH"
    ADMIN_AFFAIRS  = "ADMIN_AFFAIRS"
    VISIT          = "VISIT"
    MEAL           = "MEAL"
    OTHER          = "OTHER"


class InquiryStatus(str, enum.Enum):
    UNREAD   = "UNREAD"
    READ     = "READ"
    ANSWERED = "ANSWERED"   # 8차 추가


class ClassificationStatus(str, enum.Enum):
    SUCCESS              = "SUCCESS"
    THRESHOLD_FALLBACK   = "THRESHOLD_FALLBACK"
    LLM_ERROR_FALLBACK   = "LLM_ERROR_FALLBACK"


class Inquiry(Base):
    __tablename__ = "inquiry"

    id                    : Mapped[int]  = mapped_column(BigInteger, primary_key=True)
    guardian_user_id      : Mapped[int]  = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    resident_id           : Mapped[int]  = mapped_column(BigInteger, ForeignKey("resident.id"), nullable=False)
    facility_id           : Mapped[int]  = mapped_column(BigInteger, ForeignKey("facility.id"), nullable=False)
    title                 : Mapped[str | None] = mapped_column(String(100))
    content               : Mapped[str]  = mapped_column(Text, nullable=False)
    category              : Mapped[InquiryCategory] = mapped_column(
        Enum(InquiryCategory, name="inquiry_category", create_type=False), nullable=False
    )
    confidence            : Mapped[float | None] = mapped_column(Float)
    classification_scores : Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    classification_status : Mapped[ClassificationStatus] = mapped_column(
        Enum(ClassificationStatus, name="classification_status", create_type=False), nullable=False
    )
    status                : Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus, name="inquiry_status", create_type=False),
        nullable=False,
        default=InquiryStatus.UNREAD,
    )
    read_by               : Mapped[int | None] = mapped_column(BigInteger, ForeignKey("app_user.id"))
    read_at               : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    answer_read_at        : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 8차 추가

    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    guardian : Mapped["AppUser"] = orm_relationship(foreign_keys=[guardian_user_id])  # type: ignore[name-defined]
    resident : Mapped["Resident"] = orm_relationship()  # type: ignore[name-defined]

    # 8차: 1:1 답변 관계 (active 답변 = deleted_at IS NULL 인 것)
    answer : Mapped["InquiryAnswer | None"] = orm_relationship(
        "InquiryAnswer",
        primaryjoin="and_(Inquiry.id == InquiryAnswer.inquiry_id, InquiryAnswer.deleted_at == None)",
        foreign_keys="InquiryAnswer.inquiry_id",
        uselist=False,
        lazy="joined",
        viewonly=True,
    )


class InquiryAnswer(Base):
    """8차 스프린트: 문의 답변 (1 문의 = 1 활성 답변)"""
    __tablename__ = "inquiry_answer"

    id          : Mapped[int]  = mapped_column(BigInteger, primary_key=True)
    inquiry_id  : Mapped[int]  = mapped_column(BigInteger, ForeignKey("inquiry.id"), nullable=False)
    author_id   : Mapped[int]  = mapped_column(BigInteger, ForeignKey("app_user.id"), nullable=False)
    content     : Mapped[str]  = mapped_column(Text, nullable=False)

    created_at  : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at  : Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author : Mapped["AppUser"] = orm_relationship(foreign_keys=[author_id])  # type: ignore[name-defined]

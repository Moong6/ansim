"""
3차 스프린트: 주간 안심 리포트 ORM 모델

설계 메모:
- 1차의 ``NoticeTone``, ``NoticeStatus`` enum 을 그대로 재사용
  (새 enum 만들지 않음 — 핸드오프 문서 4단계 결정)
- ``TimestampMixin`` 도 1차 ``models.py`` 의 것을 그대로 상속
- ``resident`` / ``author`` 단방향 관계만 정의 (1·2차 파일 안 건드림)
- 1차 notice 와 달리 ``version`` / ``root_notice_id`` 없음 — append-only 미적용
  (수정 시 새 리포트 생성. 빈도 낮아 단순화)
"""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    SmallInteger,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship

from app.db.session import Base
from app.models.models import (
    AppUser,         # noqa: F401  (관계 해석에 필요)
    NoticeStatus,
    NoticeTone,
    Resident,        # noqa: F401
    TimestampMixin,
)


class Report(TimestampMixin, Base):
    __tablename__ = "report"

    id:                Mapped[int] = mapped_column(BigInteger, primary_key=True)
    resident_id:       Mapped[int] = mapped_column(
        BigInteger, ForeignKey("resident.id"), nullable=False
    )
    author_id:         Mapped[int] = mapped_column(
        BigInteger, ForeignKey("app_user.id"), nullable=False
    )

    period_start:      Mapped[date] = mapped_column(Date, nullable=False)  # 월요일
    period_end:        Mapped[date] = mapped_column(Date, nullable=False)  # 일요일
    recorded_days:     Mapped[int]  = mapped_column(SmallInteger, nullable=False)

    # 코드 집계 결과 (LLM 아님). ReportService 가 SQL 로 집계 → 그대로 저장
    stats_summary:     Mapped[dict] = mapped_column(JSONB, nullable=False)

    # AI 가 어떤 notice 행들을 보고 썼는지 추적 (검증 로그용)
    source_notice_ids: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list
    )

    tone: Mapped[NoticeTone] = mapped_column(
        Enum(NoticeTone, name="notice_tone", create_type=False),
        nullable=False,
        default=NoticeTone.POLITE,
    )

    ai_generated_text: Mapped[str | None] = mapped_column(Text)     # AI 원본
    final_text:        Mapped[str | None] = mapped_column(Text)     # 직원 편집본 (UPDATE 금지)

    status: Mapped[NoticeStatus] = mapped_column(
        Enum(NoticeStatus, name="notice_status", create_type=False),
        nullable=False,
        default=NoticeStatus.DRAFT,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ─── 관계 (단방향) ─────────────────────────────────────────────────────────
    # 1·2차 Resident / AppUser 모델은 건드리지 않음 → back_populates 없음
    resident: Mapped["Resident"] = orm_relationship("Resident", lazy="select")
    author:   Mapped["AppUser"]  = orm_relationship("AppUser",  lazy="select")

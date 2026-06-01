"""
GET /api/home/summary

홈 그리드 4개 활성 카드의 카운트를 단일 호출로 반환.
비활성 카드 4개(앨범/일정/식단/보호자문의)는 응답에 포함하지 않음.

집계 항목:
  alimjang.todayTotal     : 담당 어르신 수
  alimjang.todayCompleted : 오늘 SENT 알림장이 있는 담당 어르신 수
  report.lastWeekAvailable: 지난주 SENT notice 3건+ 인 담당 어르신이 1명 이상이면 true
  board.unreadCount       : 시설 내 최근 7일 notice_board 건수 (MVP, 읽음 추적 없음)
  residents.assignedCount : 담당 어르신 수
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, cast, func, select
from sqlalchemy import Date as SADate
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.album import Album
from app.models.board import NoticeBoard
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.meal_schedule import MealLog, ScheduleEvent
from app.models.models import AppUser, Assignment, Notice, NoticeStatus, Resident
from app.schemas.home import (
    AlbumsSummaryHome,
    AlimjangSummary,
    BoardSummary,
    HomeSummaryResponse,
    InquirySummaryHome,
    MealsSummaryHome,
    ReportSummary,
    ResidentsSummary,
    ScheduleSummaryHome,
)

router = APIRouter(prefix="/api/home", tags=["home"])


@router.get("/summary", response_model=HomeSummaryResponse)
def get_home_summary(
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> HomeSummaryResponse:

    # ── 1. 담당 어르신 id 목록 ─────────────────────────────────────────────────
    resident_ids: list[int] = list(
        db.scalars(
            select(Assignment.resident_id)
            .join(Resident, Assignment.resident_id == Resident.id)
            .where(Assignment.user_id == current_user.id)
            .where(Assignment.deleted_at.is_(None))
            .where(Resident.deleted_at.is_(None))
        ).all()
    )
    assigned_count = len(resident_ids)

    # ── 2. 알림장: 오늘 SENT 건수 ─────────────────────────────────────────────
    today_completed = 0
    if resident_ids:
        today_completed = db.scalar(
            select(func.count(func.distinct(Notice.resident_id)))
            .where(Notice.resident_id.in_(resident_ids))
            .where(Notice.status == NoticeStatus.SENT)
            .where(cast(Notice.sent_at, SADate) == func.current_date())
            .where(Notice.deleted_at.is_(None))
        ) or 0

    # ── 3. 리포트: 지난주 SENT notice 3건+ 인 어르신 존재 여부 ──────────────────
    #
    # 지난주 = date_trunc('week', CURRENT_DATE) - 7일  ~  - 1일
    # 각 어르신의 지난주 SENT notice 건수를 세어 3건 이상인 행이 하나라도 있으면 true.
    last_week_available = False
    if resident_ids:
        today = date.today()
        # ISO 주 월요일 기준
        last_monday = today - timedelta(days=today.weekday() + 7)
        last_sunday = last_monday + timedelta(days=6)

        # 어르신별 지난주 SENT notice 수를 집계해 3건 이상인 어르신 수 조회
        subq = (
            select(
                Notice.resident_id,
                func.count(Notice.id).label("cnt"),
            )
            .where(Notice.resident_id.in_(resident_ids))
            .where(Notice.status == NoticeStatus.SENT)
            .where(cast(Notice.sent_at, SADate) >= last_monday)
            .where(cast(Notice.sent_at, SADate) <= last_sunday)
            .where(Notice.deleted_at.is_(None))
            .group_by(Notice.resident_id)
            .subquery()
        )
        qualifying = db.scalar(
            select(func.count()).select_from(subq).where(subq.c.cnt >= 3)
        ) or 0
        last_week_available = qualifying > 0

    # ── 4. 공지사항: 최근 7일 내 시설 notice_board 건수 ─────────────────────────
    seven_days_ago = datetime.now(tz=timezone.utc) - timedelta(days=7)
    unread_count = db.scalar(
        select(func.count(NoticeBoard.id))
        .where(NoticeBoard.facility_id == current_user.facility_id)
        .where(NoticeBoard.created_at >= seven_days_ago)
        .where(NoticeBoard.deleted_at.is_(None))
    ) or 0

    # ── 5. 보호자 문의 미확인 수 + 답변 대기 수 (8차) ───────────────────────────
    inquiry_unread = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.status == InquiryStatus.UNREAD)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    inquiry_needs_answer = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.status == InquiryStatus.READ)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    # ── 6. 식단 오늘 등록 수 (6차) ───────────────────────────────────────────────
    today_meal_count = db.scalar(
        select(func.count(MealLog.id))
        .where(MealLog.facility_id == current_user.facility_id)
        .where(MealLog.meal_date == func.current_date())
        .where(MealLog.deleted_at.is_(None))
    ) or 0

    # ── 7. 이번 달 일정 건수 (6차) ───────────────────────────────────────────────
    today_date = date.today()
    month_start = date(today_date.year, today_date.month, 1)
    if today_date.month == 12:
        month_end = date(today_date.year + 1, 1, 1)
    else:
        month_end = date(today_date.year, today_date.month + 1, 1)

    this_month_schedule = db.scalar(
        select(func.count(ScheduleEvent.id))
        .where(ScheduleEvent.facility_id == current_user.facility_id)
        .where(ScheduleEvent.event_date >= month_start)
        .where(ScheduleEvent.event_date < month_end)
        .where(ScheduleEvent.deleted_at.is_(None))
    ) or 0

    # ── 8. 이번 달 앨범 건수 (7차) ───────────────────────────────────────────────
    this_month_albums = db.scalar(
        select(func.count(Album.id))
        .where(Album.facility_id == current_user.facility_id)
        .where(Album.activity_date >= month_start)
        .where(Album.activity_date < month_end)
        .where(Album.deleted_at.is_(None))
    ) or 0

    return HomeSummaryResponse(
        alimjang=AlimjangSummary(
            todayTotal=assigned_count,
            todayCompleted=today_completed,
        ),
        report=ReportSummary(lastWeekAvailable=last_week_available),
        board=BoardSummary(unreadCount=unread_count),
        residents=ResidentsSummary(assignedCount=assigned_count),
        inquiry=InquirySummaryHome(unreadCount=inquiry_unread, needsAnswerCount=inquiry_needs_answer),
        meals=MealsSummaryHome(todayRegisteredCount=today_meal_count),
        schedule=ScheduleSummaryHome(thisMonthCount=this_month_schedule),
        albums=AlbumsSummaryHome(thisMonthCount=this_month_albums),
    )

"""
5차+6차+7차 스프린트: 보호자 채널 API

  GET  /api/parent/me
  GET  /api/parent/board
  GET  /api/parent/board/{id}
  GET  /api/parent/notices
  GET  /api/parent/notices/{id}
  GET  /api/parent/reports
  GET  /api/parent/reports/{id}
  GET  /api/parent/inquiries
  GET  /api/parent/inquiries/{id}
  POST /api/parent/inquiries
  GET  /api/parent/meals           (6차)
  GET  /api/parent/schedule        (6차)
  GET  /api/parent/albums          (7차)
  GET  /api/parent/albums/{id}     (7차)

보안: 모든 엔드포인트에 require_guardian 적용.
      단건 조회 시 guardian → resident → 데이터 JOIN으로 본인 어르신만 허용.
      앨범: album_resident JOIN guardian으로 본인 어르신 참여 앨범만 허용.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import cast, func, select
from sqlalchemy import Date as SADate
from sqlalchemy.orm import Session

from app.core.deps import require_guardian
from app.db.session import get_db
from app.models.album import Album, album_resident_table
from app.models.board import NoticeBoard
from app.models.inquiry import ClassificationStatus, Inquiry, InquiryAnswer, InquiryCategory, InquiryStatus
from app.models.meal_schedule import MealLog, MealType, ScheduleEvent, ScheduleEventType
from app.models.models import AppUser, Guardian, Notice, NoticeStatus, Resident
from app.models.report import Report
from app.schemas.album import (
    AlbumDetailParent,
    AlbumDetailParentResponse,
    AlbumListItemParent,
    AlbumListParentResponse,
    ParticipantParentOut,
    PhotoItemOut,
)
from app.schemas.meal import MealOutParent, MealsDayParentResponse, PhotoItem
from app.schemas.parent import (
    InquiryCreateRequest,
    InquiryCreateResponse,
    InquiryCreatedOut,
    ParentAlbumsSummaryOut,
    ParentAnswerAuthorOut,
    ParentAnswerOut,
    ParentBoardDetailOut,
    ParentBoardDetailResponse,
    ParentBoardItemOut,
    ParentBoardListResponse,
    ParentInquiryDetailOut,
    ParentInquiryDetailResponse,
    ParentInquiryItemOut,
    ParentInquiryListResponse,
    ParentMealsSummaryOut,
    ParentMeResponse,
    ParentNoticeDetailOut,
    ParentNoticeDetailResponse,
    ParentNoticeItemOut,
    ParentNoticeListResponse,
    ParentReportDetailOut,
    ParentReportDetailResponse,
    ParentReportItemOut,
    ParentReportListResponse,
    ParentResidentOut,
    ParentScheduleSummaryOut,
    ParentSummaryOut,
    ParentUserOut,
)
from app.schemas.schedule import ResidentOut, ScheduleEventParentOut, ScheduleMonthParentResponse
from app.services.classification_service import classify_inquiry

router = APIRouter(prefix="/api/parent", tags=["parent"])


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _calc_age(birth_date: date | None) -> int:
    if birth_date is None:
        return 0
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _get_resident_ids_for_guardian(db: Session, user_id: int) -> list[int]:
    """해당 보호자 계정이 연결된 어르신 id 목록."""
    rows = db.scalars(
        select(Guardian.resident_id)
        .where(Guardian.user_id == user_id)
        .where(Guardian.deleted_at.is_(None))
    ).all()
    return list(rows)


def _assert_resident_belongs_to_guardian(
    db: Session, user_id: int, resident_id: int
) -> None:
    guardian = db.scalars(
        select(Guardian)
        .where(Guardian.user_id == user_id)
        .where(Guardian.resident_id == resident_id)
        .where(Guardian.deleted_at.is_(None))
    ).first()
    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "본인 어르신이 아닙니다"},
        )


def _current_notice_for_resident(db: Session, resident_id: int) -> Notice | None:
    """해당 어르신의 최신본(MAX version, SENT) notice 반환."""
    from sqlalchemy import and_
    subq = (
        select(Notice.resident_id, func.max(Notice.version).label("max_v"))
        .where(Notice.resident_id == resident_id)
        .where(Notice.status == NoticeStatus.SENT)
        .where(Notice.deleted_at.is_(None))
        .group_by(Notice.resident_id)
        .subquery()
    )
    return db.scalars(
        select(Notice)
        .join(subq, (Notice.resident_id == subq.c.resident_id) & (Notice.version == subq.c.max_v))
        .where(Notice.deleted_at.is_(None))
    ).first()


# ─── 1. GET /api/parent/me ────────────────────────────────────────────────────

@router.get("/me", response_model=ParentMeResponse)
def get_parent_me(
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentMeResponse:

    resident_ids = _get_resident_ids_for_guardian(db, current_user.id)

    # 어르신 목록
    residents_out: list[ParentResidentOut] = []
    for rid in resident_ids:
        resident = db.get(Resident, rid)
        if not resident or resident.deleted_at:
            continue
        guardian_row = db.scalars(
            select(Guardian)
            .where(Guardian.user_id == current_user.id)
            .where(Guardian.resident_id == rid)
            .where(Guardian.deleted_at.is_(None))
        ).first()
        residents_out.append(ParentResidentOut(
            id=resident.id,
            name=resident.name,
            age=_calc_age(resident.birth_date),
            roomNumber=resident.room_number,
            careLevel=resident.care_level,
            relationship=guardian_row.relationship if guardian_row else None,
        ))

    # summary 집계
    seven_days_ago = datetime.now(tz=timezone.utc) - timedelta(days=7)
    unread_board = db.scalar(
        select(func.count(NoticeBoard.id))
        .where(NoticeBoard.facility_id == current_user.facility_id)
        .where(NoticeBoard.created_at >= seven_days_ago)
        .where(NoticeBoard.deleted_at.is_(None))
    ) or 0

    # 미확인 알림장 (SENT + read_at IS NULL, 최신본만)
    unread_notice = 0
    if resident_ids:
        subq = (
            select(Notice.resident_id, func.max(Notice.version).label("max_v"))
            .where(Notice.resident_id.in_(resident_ids))
            .where(Notice.status == NoticeStatus.SENT)
            .where(Notice.deleted_at.is_(None))
            .group_by(Notice.resident_id)
            .subquery()
        )
        unread_notice = db.scalar(
            select(func.count())
            .select_from(Notice)
            .join(subq, (Notice.resident_id == subq.c.resident_id) & (Notice.version == subq.c.max_v))
            .where(Notice.read_at.is_(None))
            .where(Notice.deleted_at.is_(None))
        ) or 0

    # 미확인 리포트 (SENT + read_at IS NULL)
    new_report = 0
    if resident_ids:
        new_report = db.scalar(
            select(func.count(Report.id))
            .where(Report.resident_id.in_(resident_ids))
            .where(Report.status == NoticeStatus.SENT)
            .where(Report.read_at.is_(None))
            .where(Report.deleted_at.is_(None))
        ) or 0

    # 본인 UNREAD 문의 수
    pending_inquiry = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.guardian_user_id == current_user.id)
        .where(Inquiry.status == InquiryStatus.UNREAD)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    # 8차: 보호자 미확인 답변 수 (status=ANSWERED && answer_read_at IS NULL)
    inquiry_new_answer_count = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.guardian_user_id == current_user.id)
        .where(Inquiry.status == InquiryStatus.ANSWERED)
        .where(Inquiry.answer_read_at.is_(None))
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    # 오늘 식단 등록 수 (6차)
    today_meal_count = db.scalar(
        select(func.count(MealLog.id))
        .where(MealLog.facility_id == current_user.facility_id)
        .where(MealLog.meal_date == func.current_date())
        .where(MealLog.deleted_at.is_(None))
    ) or 0

    # 이번 달 일정 건수 (6차)
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

    # 이번 달 본인 어르신 참여 앨범 건수 (7차)
    my_resident_albums = 0
    if resident_ids:
        my_resident_albums = db.scalar(
            select(func.count(func.distinct(Album.id)))
            .join(album_resident_table, Album.id == album_resident_table.c.album_id)
            .where(album_resident_table.c.resident_id.in_(resident_ids))
            .where(Album.activity_date >= month_start)
            .where(Album.activity_date < month_end)
            .where(Album.deleted_at.is_(None))
        ) or 0

    return ParentMeResponse(
        user=ParentUserOut(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            role=current_user.role.value,
        ),
        residents=residents_out,
        summary=ParentSummaryOut(
            unreadBoardCount=unread_board,
            unreadNoticeCount=unread_notice,
            newReportCount=new_report,
            pendingInquiryCount=pending_inquiry,
            inquiryNewAnswerCount=inquiry_new_answer_count,   # 8차
            meals=ParentMealsSummaryOut(todayRegisteredCount=today_meal_count),
            schedule=ParentScheduleSummaryOut(thisMonthCount=this_month_schedule),
            albums=ParentAlbumsSummaryOut(myResidentInThisMonth=my_resident_albums),
        ),
    )


# ─── 2-3. GET /api/parent/board(/{id}) ───────────────────────────────────────

@router.get("/board", response_model=ParentBoardListResponse)
def get_parent_board(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentBoardListResponse:

    base = (
        select(NoticeBoard)
        .where(NoticeBoard.facility_id == current_user.facility_id)
        .where(NoticeBoard.deleted_at.is_(None))
        .order_by(NoticeBoard.created_at.desc())
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(base.limit(limit).offset(offset)).all()

    items = [
        ParentBoardItemOut(
            id=r.id,
            title=r.title,
            preview=r.content[:100],
            createdAt=r.created_at,
            canEdit=False,
        )
        for r in rows
    ]
    return ParentBoardListResponse(total=total, items=items)


@router.get("/board/{post_id}", response_model=ParentBoardDetailResponse)
def get_parent_board_detail(
    post_id: int,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentBoardDetailResponse:

    post = db.get(NoticeBoard, post_id)
    if not post or post.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "공지가 없습니다"})
    if post.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    return ParentBoardDetailResponse(
        post=ParentBoardDetailOut(
            id=post.id,
            title=post.title,
            content=post.content,
            createdAt=post.created_at,
            updatedAt=post.updated_at,
            canEdit=False,
        )
    )


# ─── 4-5. GET /api/parent/notices(/{id}) ─────────────────────────────────────

def _sent_notices_for_guardian(db: Session, resident_ids: list[int]) -> list[Notice]:
    if not resident_ids:
        return []
    subq = (
        select(Notice.resident_id, func.max(Notice.version).label("max_v"))
        .where(Notice.resident_id.in_(resident_ids))
        .where(Notice.status == NoticeStatus.SENT)
        .where(Notice.deleted_at.is_(None))
        .group_by(Notice.resident_id)
        .subquery()
    )
    return list(
        db.scalars(
            select(Notice)
            .join(subq, (Notice.resident_id == subq.c.resident_id) & (Notice.version == subq.c.max_v))
            .where(Notice.deleted_at.is_(None))
            .order_by(Notice.sent_at.desc())
        ).all()
    )


@router.get("/notices", response_model=ParentNoticeListResponse)
def get_parent_notices(
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentNoticeListResponse:

    resident_ids = _get_resident_ids_for_guardian(db, current_user.id)
    notices = _sent_notices_for_guardian(db, resident_ids)

    items = []
    for n in notices:
        resident = db.get(Resident, n.resident_id)
        final_text = n.final_polished_text or ""
        items.append(ParentNoticeItemOut(
            id=n.id,
            residentId=n.resident_id,
            residentName=resident.name if resident else "",
            preview=final_text[:80],
            sentAt=n.sent_at,
            readAt=n.read_at,
        ))

    return ParentNoticeListResponse(total=len(items), items=items)


@router.get("/notices/{notice_id}", response_model=ParentNoticeDetailResponse)
def get_parent_notice_detail(
    notice_id: int,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentNoticeDetailResponse:

    notice = db.get(Notice, notice_id)
    if not notice or notice.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOTICE_NOT_FOUND", "message": "알림장이 없습니다"})

    _assert_resident_belongs_to_guardian(db, current_user.id, notice.resident_id)

    # 최초 조회 시 read_at 갱신
    if notice.read_at is None:
        notice.read_at = datetime.now(tz=timezone.utc)
        db.add(notice)
        db.commit()
        db.refresh(notice)

    resident = db.get(Resident, notice.resident_id)
    return ParentNoticeDetailResponse(
        notice=ParentNoticeDetailOut(
            id=notice.id,
            residentName=resident.name if resident else "",
            finalText=notice.final_polished_text,
            structuredStatus=notice.structured_status,
            sentAt=notice.sent_at,
            readAt=notice.read_at,
        )
    )


# ─── 6-7. GET /api/parent/reports(/{id}) ─────────────────────────────────────

@router.get("/reports", response_model=ParentReportListResponse)
def get_parent_reports(
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentReportListResponse:

    resident_ids = _get_resident_ids_for_guardian(db, current_user.id)
    if not resident_ids:
        return ParentReportListResponse(total=0, items=[])

    reports = db.scalars(
        select(Report)
        .where(Report.resident_id.in_(resident_ids))
        .where(Report.status == NoticeStatus.SENT)
        .where(Report.deleted_at.is_(None))
        .order_by(Report.sent_at.desc())
    ).all()

    items = []
    for r in reports:
        resident = db.get(Resident, r.resident_id)
        preview = (r.final_text or r.ai_generated_text or "")[:80]
        items.append(ParentReportItemOut(
            id=r.id,
            residentId=r.resident_id,
            residentName=resident.name if resident else "",
            preview=preview,
            sentAt=r.sent_at,
            readAt=r.read_at,
        ))

    return ParentReportListResponse(total=len(items), items=items)


@router.get("/reports/{report_id}", response_model=ParentReportDetailResponse)
def get_parent_report_detail(
    report_id: int,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentReportDetailResponse:

    report = db.get(Report, report_id)
    if not report or report.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "리포트가 없습니다"})

    _assert_resident_belongs_to_guardian(db, current_user.id, report.resident_id)

    if report.read_at is None:
        report.read_at = datetime.now(tz=timezone.utc)
        db.add(report)
        db.commit()
        db.refresh(report)

    # topMeal, topMood 최빈값 집계
    stats = report.stats_summary or {}
    meal_dist = stats.get("meal", {})
    mood_dist = stats.get("mood", {})

    def _get_top_key(dist: dict, default: str) -> str:
        if not dist:
            return default
        best_key = default
        best_val = -1
        for k, v in dist.items():
            if isinstance(v, (int, float)) and v > best_val:
                best_val = v
                best_key = k
        if best_val <= 0:
            return default
        return best_key

    top_meal = _get_top_key(meal_dist, "NORMAL")
    top_mood = _get_top_key(mood_dist, "GOOD")

    week_stats = {
        "recordedDays": report.recorded_days,
        "topMood": top_mood,
        "topMeal": top_meal,
    }

    resident = db.get(Resident, report.resident_id)
    return ParentReportDetailResponse(
        report=ParentReportDetailOut(
            id=report.id,
            residentName=resident.name if resident else "",
            finalText=report.final_text,
            weekStats=week_stats,
            sentAt=report.sent_at,
            readAt=report.read_at,
        )
    )


# ─── 8-10. /api/parent/inquiries ─────────────────────────────────────────────

@router.get("/inquiries", response_model=ParentInquiryListResponse)
def get_parent_inquiries(
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentInquiryListResponse:

    # 8차: hasNewAnswer 우선 → 최신순
    rows = db.scalars(
        select(Inquiry)
        .where(Inquiry.guardian_user_id == current_user.id)
        .where(Inquiry.deleted_at.is_(None))
        .order_by(
            # hasNewAnswer (ANSWERED + answer_read_at IS NULL) 우선
            (
                (Inquiry.status == InquiryStatus.ANSWERED) &
                Inquiry.answer_read_at.is_(None)
            ).desc(),
            Inquiry.created_at.desc(),
        )
    ).all()

    items = []
    for r in rows:
        has_new_answer = (r.status == InquiryStatus.ANSWERED and r.answer_read_at is None)
        # 8차: 활성 답변 첫 50자 미리보기
        answer_preview: str | None = None
        if r.answer:
            answer_preview = r.answer.content[:50]
        items.append(ParentInquiryItemOut(
            id=r.id,
            category=r.category.value,
            preview=(r.content or "")[:80],
            status=r.status.value,
            createdAt=r.created_at,
            hasNewAnswer=has_new_answer,
            answerPreview=answer_preview,
        ))
    return ParentInquiryListResponse(total=len(items), items=items)


@router.get("/inquiries/{inquiry_id}", response_model=ParentInquiryDetailResponse)
def get_parent_inquiry_detail(
    inquiry_id: int,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ParentInquiryDetailResponse:

    inquiry = db.get(Inquiry, inquiry_id)
    if not inquiry or inquiry.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "문의가 없습니다"})
    if inquiry.guardian_user_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "본인 문의만 조회 가능합니다"})

    # 8차: ANSWERED + answer_read_at IS NULL → 첫 진입 시 자동 갱신
    if inquiry.status == InquiryStatus.ANSWERED and inquiry.answer_read_at is None:
        inquiry.answer_read_at = datetime.now(tz=timezone.utc)
        db.add(inquiry)
        db.commit()
        db.refresh(inquiry)

    # 8차: 활성 답변 → 보호자용 응답 (author.id 제외)
    answer_out: ParentAnswerOut | None = None
    if inquiry.answer:
        ans = inquiry.answer
        answer_out = ParentAnswerOut(
            content=ans.content,
            author=ParentAnswerAuthorOut(
                name=ans.author.name,
                role=ans.author.role.value,
            ),
            createdAt=ans.created_at,
        )

    return ParentInquiryDetailResponse(
        inquiry=ParentInquiryDetailOut(
            id=inquiry.id,
            category=inquiry.category.value,
            title=inquiry.title,
            content=inquiry.content,
            status=inquiry.status.value,
            createdAt=inquiry.created_at,
            answer=answer_out,
        )
    )


@router.post("/inquiries", response_model=InquiryCreateResponse, status_code=201)
def create_parent_inquiry(
    body: InquiryCreateRequest,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> InquiryCreateResponse:

    # 1. 본인 어르신인지 확인
    _assert_resident_belongs_to_guardian(db, current_user.id, body.residentId)

    # 2. 검증
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "본문은 필수입니다"},
        )
    if len(content) > 500:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "본문은 500자 이하입니다"},
        )
    if body.title and len(body.title) > 100:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "제목은 100자 이하입니다"},
        )

    # 3. AI 분류 (LLM 실패 시 fallback, 502 안 던짐)
    result = classify_inquiry(content)

    # 4. INSERT
    new_inquiry = Inquiry(
        guardian_user_id=current_user.id,
        resident_id=body.residentId,
        facility_id=current_user.facility_id,
        title=body.title,
        content=content,
        category=result.category,
        confidence=result.confidence,
        classification_scores=result.scores,
        classification_status=result.classification_status,
        status=InquiryStatus.UNREAD,
    )
    db.add(new_inquiry)
    db.commit()
    db.refresh(new_inquiry)

    # 응답에 confidence·classification_status 노출 금지
    return InquiryCreateResponse(
        inquiry=InquiryCreatedOut(
            id=new_inquiry.id,
            category=new_inquiry.category.value,
            status=new_inquiry.status.value,
            createdAt=new_inquiry.created_at,
        )
    )


# ─── 6차: GET /api/parent/meals?date=YYYY-MM-DD ────────────────────────────────

_WEEKDAY = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
_MEAL_ORDER = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACK]


@router.get("/meals", response_model=MealsDayParentResponse)
def get_parent_meals(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> MealsDayParentResponse:

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE", "message": "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"},
        )

    today = date.today()

    rows = db.scalars(
        select(MealLog)
        .where(MealLog.facility_id == current_user.facility_id)
        .where(MealLog.meal_date == target_date)
        .where(MealLog.deleted_at.is_(None))
    ).all()

    rows_sorted = sorted(rows, key=lambda m: _MEAL_ORDER.index(m.meal_type))

    meals_out = [
        MealOutParent(
            mealType=m.meal_type,
            menuText=m.menu_text,
            photos=[PhotoItem(url=p["url"]) for p in (m.photos or [])],
        )
        for m in rows_sorted
    ]

    return MealsDayParentResponse(
        date=target_date.isoformat(),
        weekday=_WEEKDAY[target_date.weekday()],
        isToday=(target_date == today),
        meals=meals_out,
    )


# ─── 6차: GET /api/parent/schedule?year=&month= ────────────────────────────────

def _calc_age_p(birth_date: date | None) -> int | None:
    if birth_date is None:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


@router.get("/schedule", response_model=ScheduleMonthParentResponse)
def get_parent_schedule(
    year:  int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> ScheduleMonthParentResponse:

    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    rows = db.scalars(
        select(ScheduleEvent)
        .where(ScheduleEvent.facility_id == current_user.facility_id)
        .where(ScheduleEvent.deleted_at.is_(None))
        .where(ScheduleEvent.event_date >= month_start)
        .where(ScheduleEvent.event_date < month_end)
        .order_by(ScheduleEvent.event_date)
    ).all()

    events_out: list[ScheduleEventParentOut] = []
    for ev in rows:
        resident_out = None
        if ev.event_type == ScheduleEventType.BIRTHDAY and ev.resident:
            r = ev.resident
            resident_out = ResidentOut(
                id=r.id,
                name=r.name,
                roomNumber=r.room_number,
                age=_calc_age_p(r.birth_date),
            )
        events_out.append(ScheduleEventParentOut(
            id=ev.id,
            eventDate=ev.event_date,
            eventType=ev.event_type,
            title=ev.title,
            description=ev.description,
            resident=resident_out,
        ))

    return ScheduleMonthParentResponse(year=year, month=month, events=events_out)


# ─── 7차: GET /api/parent/albums?year=&month= ─────────────────────────────────

@router.get("/albums", response_model=AlbumListParentResponse)
def get_parent_albums(
    year:  int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> AlbumListParentResponse:
    """
    보호자: 본인 어르신이 참여한 앨범 목록 (보안 JOIN).
    activity_date 내림차순 정렬.
    """
    resident_ids = _get_resident_ids_for_guardian(db, current_user.id)
    if not resident_ids:
        return AlbumListParentResponse(year=year, month=month, total=0, items=[])

    month_start = date(year, month, 1)
    month_end   = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    rows = db.scalars(
        select(Album)
        .join(album_resident_table, Album.id == album_resident_table.c.album_id)
        .where(album_resident_table.c.resident_id.in_(resident_ids))
        .where(Album.activity_date >= month_start)
        .where(Album.activity_date <  month_end)
        .where(Album.deleted_at.is_(None))
        .order_by(Album.activity_date.desc(), Album.id.desc())
        .distinct()
    ).all()

    items: list[AlbumListItemParent] = []
    for album in rows:
        photos = album.photos or []
        # 본인 어르신만 필터링하여 참여자로 표시
        visible_residents = [r for r in album.residents if r.id in resident_ids]
        act_date = album.activity_date.date() if isinstance(album.activity_date, datetime) else album.activity_date
        items.append(AlbumListItemParent(
            id=album.id,
            activityDate=act_date,
            title=album.title,
            description=album.description,
            photoCount=len(photos),
            thumbnailUrl=photos[0]["url"] if photos else None,
            participants=[ParticipantParentOut(id=r.id, name=r.name) for r in visible_residents],
        ))

    return AlbumListParentResponse(year=year, month=month, total=len(items), items=items)


# ─── 7차: GET /api/parent/albums/{album_id} ──────────────────────────────────

@router.get("/albums/{album_id}", response_model=AlbumDetailParentResponse)
def get_parent_album_detail(
    album_id: int,
    current_user: AppUser = Depends(require_guardian),
    db: Session = Depends(get_db),
) -> AlbumDetailParentResponse:
    """
    보호자: 앨범 단건. 본인 어르신이 참여한 앨범이 아니면 403.
    """
    album = db.get(Album, album_id)
    if not album or album.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "앨범을 찾을 수 없습니다"},
        )

    resident_ids = _get_resident_ids_for_guardian(db, current_user.id)

    # 본인 어르신이 이 앨범에 참여했는지 확인
    participated = any(r.id in resident_ids for r in album.residents)
    if not participated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "본인 어르신이 참여한 앨범이 아닙니다"},
        )

    visible_residents = [r for r in album.residents if r.id in resident_ids]

    act_date = album.activity_date.date() if isinstance(album.activity_date, datetime) else album.activity_date
    return AlbumDetailParentResponse(
        album=AlbumDetailParent(
            id=album.id,
            activityDate=act_date,
            title=album.title,
            description=album.description,
            photos=[PhotoItemOut(url=p["url"]) for p in (album.photos or [])],
            participants=[ParticipantParentOut(id=r.id, name=r.name) for r in visible_residents],
        )
    )

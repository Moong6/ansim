"""
6차 스프린트: 일정표 CRUD

GET    /api/schedule?year=2026&month=5   (require_staff)
POST   /api/schedule                     (require_content_editor)
PATCH  /api/schedule/{id}               (require_content_editor)
DELETE /api/schedule/{id}               (require_content_editor)
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_content_editor, require_staff
from app.db.session import get_db
from app.models.meal_schedule import ScheduleEvent, ScheduleEventType
from app.models.models import AppUser, Resident
from app.schemas.schedule import (
    AuthorOut,
    ResidentOut,
    ScheduleCreateRequest,
    ScheduleEventOut,
    ScheduleMonthResponse,
    ScheduleUpdateRequest,
)

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


def _calc_age(birth_date: date | None) -> int | None:
    if birth_date is None:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _event_to_out(ev: ScheduleEvent) -> ScheduleEventOut:
    resident_out = None
    if ev.event_type == ScheduleEventType.BIRTHDAY and ev.resident:
        r = ev.resident
        resident_out = ResidentOut(
            id=r.id,
            name=r.name,
            roomNumber=r.room_number,
            age=_calc_age(r.birth_date),
        )
    author_out = None
    if ev.author:
        author_out = AuthorOut(id=ev.author.id, name=ev.author.name)

    return ScheduleEventOut(
        id=ev.id,
        eventDate=ev.event_date,
        eventType=ev.event_type,
        title=ev.title,
        description=ev.description,
        resident=resident_out,
        author=author_out,
        createdAt=ev.created_at,
    )


def _validate_birthday(
    event_type: ScheduleEventType,
    resident_id: int | None,
    facility_id: int,
    db: Session,
) -> None:
    if event_type == ScheduleEventType.BIRTHDAY:
        if resident_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BIRTHDAY_REQUIRES_RESIDENT", "message": "생일 일정에는 어르신 선택이 필요합니다"},
            )
        resident = db.get(Resident, resident_id)
        if not resident or resident.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_RESIDENT_FOR_BIRTHDAY", "message": "유효하지 않은 어르신입니다"},
            )
        if resident.facility_id != facility_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_RESIDENT_FOR_BIRTHDAY", "message": "본인 시설의 어르신만 선택할 수 있습니다"},
            )
    else:
        if resident_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "RESIDENT_NOT_ALLOWED",
                    "message": "생일 유형이 아닌 경우 어르신을 선택할 수 없습니다",
                },
            )


# ─── GET /api/schedule?year=&month= ──────────────────────────────────────────

@router.get("", response_model=ScheduleMonthResponse)
def get_schedule(
    year:  int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ScheduleMonthResponse:

    rows = db.scalars(
        select(ScheduleEvent)
        .where(ScheduleEvent.facility_id == current_user.facility_id)
        .where(ScheduleEvent.deleted_at.is_(None))
        .where(
            ScheduleEvent.event_date >= date(year, month, 1)
        )
        .where(
            ScheduleEvent.event_date < date(year + (month // 12), (month % 12) + 1, 1)
        )
        .order_by(ScheduleEvent.event_date)
    ).all()

    return ScheduleMonthResponse(
        year=year,
        month=month,
        events=[_event_to_out(ev) for ev in rows],
    )


# ─── POST /api/schedule ───────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_schedule(
    body: ScheduleCreateRequest,
    current_user: AppUser = Depends(require_content_editor),
    db: Session = Depends(get_db),
) -> dict:

    _validate_birthday(body.eventType, body.residentId, current_user.facility_id, db)

    now = datetime.now(tz=timezone.utc)
    ev = ScheduleEvent(
        facility_id=current_user.facility_id,
        author_id=current_user.id,
        event_date=body.eventDate,
        event_type=body.eventType,
        title=body.title,
        description=body.description,
        resident_id=body.residentId,
        created_at=now,
        updated_at=now,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    return {"id": ev.id, "message": "일정이 등록되었습니다"}


# ─── PATCH /api/schedule/{id} ────────────────────────────────────────────────

@router.patch("/{event_id}", status_code=200)
def update_schedule(
    event_id: int,
    body: ScheduleUpdateRequest,
    current_user: AppUser = Depends(require_content_editor),
    db: Session = Depends(get_db),
) -> dict:

    ev = db.get(ScheduleEvent, event_id)
    if not ev or ev.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "일정을 찾을 수 없습니다"},
        )
    if ev.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    # 변경된 eventType 또는 residentId 조합 검증
    new_type = body.eventType if body.eventType is not None else ev.event_type
    new_resident_id = body.residentId if body.residentId is not None else (
        ev.resident_id if new_type == ScheduleEventType.BIRTHDAY else None
    )
    # BIRTHDAY → non-BIRTHDAY 전환 시 residentId 강제 null
    if new_type != ScheduleEventType.BIRTHDAY:
        new_resident_id = None

    _validate_birthday(new_type, new_resident_id, current_user.facility_id, db)

    if body.eventDate is not None:
        ev.event_date = body.eventDate
    if body.eventType is not None:
        ev.event_type = body.eventType
    if body.title is not None:
        ev.title = body.title
    if body.description is not None:
        ev.description = body.description
    ev.resident_id = new_resident_id
    ev.updated_at = datetime.now(tz=timezone.utc)

    db.commit()
    return {"id": ev.id, "message": "일정이 수정되었습니다"}


# ─── DELETE /api/schedule/{id} ───────────────────────────────────────────────

@router.delete("/{event_id}", status_code=200)
def delete_schedule(
    event_id: int,
    current_user: AppUser = Depends(require_content_editor),
    db: Session = Depends(get_db),
) -> dict:

    ev = db.get(ScheduleEvent, event_id)
    if not ev or ev.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "일정을 찾을 수 없습니다"},
        )
    if ev.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    ev.deleted_at = datetime.now(tz=timezone.utc)
    db.commit()

    return {"message": "일정이 삭제되었습니다"}

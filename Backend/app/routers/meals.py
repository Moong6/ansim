"""
6차 스프린트: 식단표 CRUD

GET    /api/meals?date=YYYY-MM-DD   (require_staff)
POST   /api/meals                   (require_content_editor)
PATCH  /api/meals/{id}              (require_content_editor)
DELETE /api/meals/{id}              (require_content_editor)
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.meal_schedule import MealLog, MealType
from app.models.models import AppUser
from app.schemas.meal import (
    AuthorOut,
    MealCreateRequest,
    MealOut,
    MealsDayResponse,
    MealUpdateRequest,
    PhotoItem,
)

router = APIRouter(prefix="/api/meals", tags=["meals"])

# 요일 영문명 매핑 (date.weekday(): 0=월요일)
_WEEKDAY = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]


def _meal_to_out(m: MealLog) -> MealOut:
    return MealOut(
        id=m.id,
        mealType=m.meal_type,
        menuText=m.menu_text,
        photos=[PhotoItem(url=p["url"]) for p in (m.photos or [])],
        author=AuthorOut(id=m.author.id, name=m.author.name),
        createdAt=m.created_at,
    )


# ─── GET /api/meals?date=YYYY-MM-DD ──────────────────────────────────────────

@router.get("", response_model=MealsDayResponse)
def get_meals(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> MealsDayResponse:

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE", "message": "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"},
        )

    today = date.today()
    if target_date > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FUTURE_DATE_NOT_ALLOWED", "message": "미래 날짜는 조회할 수 없습니다"},
        )

    rows = db.scalars(
        select(MealLog)
        .where(MealLog.facility_id == current_user.facility_id)
        .where(MealLog.meal_date == target_date)
        .where(MealLog.deleted_at.is_(None))
        .order_by(MealLog.meal_type)
    ).all()

    # meal_type 정렬 순서를 BREAKFAST→LUNCH→DINNER→SNACK로 고정
    _ORDER = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACK]
    rows_sorted = sorted(rows, key=lambda m: _ORDER.index(m.meal_type))

    return MealsDayResponse(
        date=target_date.isoformat(),
        weekday=_WEEKDAY[target_date.weekday()],
        isToday=(target_date == today),
        meals=[_meal_to_out(m) for m in rows_sorted],
    )


# ─── POST /api/meals ──────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_meal(
    body: MealCreateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    today = date.today()
    if body.mealDate > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FUTURE_DATE_NOT_ALLOWED", "message": "미래 날짜에는 식단을 등록할 수 없습니다"},
        )

    if len(body.photos) > 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOO_MANY_PHOTOS", "message": "사진은 최대 2장까지 등록할 수 있습니다"},
        )

    for p in body.photos:
        if not p.url.startswith("/static/meals/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_PHOTO_URL", "message": "유효하지 않은 사진 URL입니다"},
            )

    now = datetime.now(tz=timezone.utc)
    meal = MealLog(
        facility_id=current_user.facility_id,
        author_id=current_user.id,
        meal_date=body.mealDate,
        meal_type=body.mealType,
        menu_text=body.menuText,
        photos=[{"url": p.url, "uploadedAt": now.isoformat()} for p in body.photos],
        created_at=now,
        updated_at=now,
    )
    db.add(meal)
    try:
        db.commit()
        db.refresh(meal)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DUPLICATE_MEAL", "message": "해당 날짜·식사구분에 이미 등록된 식단이 있습니다"},
        )

    return {"id": meal.id, "message": "식단이 등록되었습니다"}


# ─── PATCH /api/meals/{id} ────────────────────────────────────────────────────

@router.patch("/{meal_id}", status_code=200)
def update_meal(
    meal_id: int,
    body: MealUpdateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    meal = db.get(MealLog, meal_id)
    if not meal or meal.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "식단을 찾을 수 없습니다"},
        )
    if meal.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    if body.mealType is not None:
        meal.meal_type = body.mealType
    if body.menuText is not None:
        meal.menu_text = body.menuText
    if body.photos is not None:
        if len(body.photos) > 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "TOO_MANY_PHOTOS", "message": "사진은 최대 2장까지 등록할 수 있습니다"},
            )
        for p in body.photos:
            if not p.url.startswith("/static/meals/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_PHOTO_URL", "message": "유효하지 않은 사진 URL입니다"},
                )
        now = datetime.now(tz=timezone.utc)
        meal.photos = [{"url": p.url, "uploadedAt": now.isoformat()} for p in body.photos]

    meal.updated_at = datetime.now(tz=timezone.utc)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DUPLICATE_MEAL", "message": "해당 날짜·식사구분에 이미 등록된 식단이 있습니다"},
        )

    return {"id": meal.id, "message": "식단이 수정되었습니다"}


# ─── DELETE /api/meals/{id} ───────────────────────────────────────────────────

@router.delete("/{meal_id}", status_code=200)
def delete_meal(
    meal_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    meal = db.get(MealLog, meal_id)
    if not meal or meal.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "식단을 찾을 수 없습니다"},
        )
    if meal.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    meal.deleted_at = datetime.now(tz=timezone.utc)
    db.commit()

    return {"message": "식단이 삭제되었습니다"}

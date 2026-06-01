"""
6차 스프린트: 식단표 Pydantic 스키마
"""

from datetime import date, datetime

from pydantic import BaseModel

from app.models.meal_schedule import MealType


# ── 공통 서브 ─────────────────────────────────────────────────────────────────

class PhotoItem(BaseModel):
    url: str


class AuthorOut(BaseModel):
    id:   int
    name: str
    model_config = {"from_attributes": True}


# ── 목록 응답 (직원) ──────────────────────────────────────────────────────────

class MealOut(BaseModel):
    id:        int
    mealType:  MealType
    menuText:  str
    photos:    list[PhotoItem]
    author:    AuthorOut
    createdAt: datetime
    model_config = {"from_attributes": True}


class MealsDayResponse(BaseModel):
    date:     str           # "YYYY-MM-DD"
    weekday:  str           # "MONDAY" ~ "SUNDAY"
    isToday:  bool
    meals:    list[MealOut]


# ── 등록 요청 ─────────────────────────────────────────────────────────────────

class MealCreateRequest(BaseModel):
    mealDate:  date
    mealType:  MealType
    menuText:  str
    photos:    list[PhotoItem] = []

    # URL 검증·중복 체크는 route handler에서 수행 (적절한 에러 코드 반환 위해)


# ── 수정 요청 (mealDate 변경 불가) ───────────────────────────────────────────

class MealUpdateRequest(BaseModel):
    mealType:  MealType | None = None
    menuText:  str | None = None
    photos:    list[PhotoItem] | None = None


# ── 보호자 응답 (id·createdAt·author 제외) ────────────────────────────────────

class MealOutParent(BaseModel):
    mealType:  MealType
    menuText:  str
    photos:    list[PhotoItem]


class MealsDayParentResponse(BaseModel):
    date:    str
    weekday: str
    isToday: bool
    meals:   list[MealOutParent]

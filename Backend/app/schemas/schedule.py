"""
6차 스프린트: 일정표 Pydantic 스키마
"""

from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.models.meal_schedule import ScheduleEventType


# ── 공통 서브 ─────────────────────────────────────────────────────────────────

class AuthorOut(BaseModel):
    id:   int
    name: str
    model_config = {"from_attributes": True}


class ResidentOut(BaseModel):
    id:         int
    name:       str
    roomNumber: str | None = None
    age:        int | None = None
    model_config = {"from_attributes": True}


# ── 목록 응답 ─────────────────────────────────────────────────────────────────

class ScheduleEventOut(BaseModel):
    id:          int
    eventDate:   date
    eventType:   ScheduleEventType
    title:       str
    description: str | None = None
    resident:    ResidentOut | None = None
    author:      AuthorOut | None = None
    createdAt:   datetime
    model_config = {"from_attributes": True}


class ScheduleMonthResponse(BaseModel):
    year:   int
    month:  int
    events: list[ScheduleEventOut]


# ── 등록 요청 ─────────────────────────────────────────────────────────────────

class ScheduleCreateRequest(BaseModel):
    eventDate:   date
    eventType:   ScheduleEventType
    title:       str
    description: str | None = None
    residentId:  int | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("제목은 필수입니다")
        if len(v) > 100:
            raise ValueError("제목은 100자 이하여야 합니다")
        return v

    @field_validator("description")
    @classmethod
    def desc_max_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("설명은 500자 이하여야 합니다")
        return v


# ── 수정 요청 ─────────────────────────────────────────────────────────────────

class ScheduleUpdateRequest(BaseModel):
    eventDate:   date | None = None
    eventType:   ScheduleEventType | None = None
    title:       str | None = None
    description: str | None = None
    residentId:  int | None = None

    @field_validator("title")
    @classmethod
    def title_check(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.strip():
                raise ValueError("제목은 필수입니다")
            if len(v) > 100:
                raise ValueError("제목은 100자 이하여야 합니다")
        return v


# ── 보호자 응답 (author 제외) ─────────────────────────────────────────────────

class ScheduleEventParentOut(BaseModel):
    id:          int
    eventDate:   date
    eventType:   ScheduleEventType
    title:       str
    description: str | None = None
    resident:    ResidentOut | None = None


class ScheduleMonthParentResponse(BaseModel):
    year:   int
    month:  int
    events: list[ScheduleEventParentOut]

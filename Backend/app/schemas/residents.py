from typing import Literal
from pydantic import BaseModel


class ResidentCard(BaseModel):
    id:             int
    name:           str
    age:            int
    roomNumber:     str | None
    profileImageUrl: str | None
    careLevel:      str | None
    todayStatus:    Literal["NONE", "SENT"]
    todayNoticeId:  int | None
    sentAt:         str | None          # ISO 8601, SENT인 경우만 값 있음


class Summary(BaseModel):
    total:     int
    completed: int


class ResidentsResponse(BaseModel):
    summary:   Summary
    residents: list[ResidentCard]


# =============================================================================
# GET /api/residents/{id}  — 단건 (precautions 툴팁용)
# =============================================================================

class ResidentDetailOut(BaseModel):
    id:               int
    name:             str
    age:              int
    birthDate:        str | None     # "YYYY-MM-DD"
    roomNumber:       str | None
    careLevel:        str | None
    precautions:      str | None     # ★ 이 엔드포인트 핵심 필드
    gender:           str | None     # "M" | "F"
    profileImageUrl:  str | None


class ResidentDetailResponse(BaseModel):
    resident: ResidentDetailOut


# =============================================================================
# PATCH /api/residents/{id}  — precautions 전용 수정 (4차 스프린트)
# =============================================================================

class ResidentUpdateSchema(BaseModel):
    """precautions 단 한 필드만 허용. extra='forbid'로 다른 필드 시도 시 422."""

    model_config = {"extra": "forbid"}

    precautions: str


class ResidentUpdateResponse(BaseModel):
    id:          int
    name:        str
    roomNumber:  str | None
    careLevel:   str | None
    precautions: str | None
    updatedAt:   str          # ISO 8601

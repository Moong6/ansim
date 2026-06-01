"""
5차 스프린트: 직원 문의 처리 Pydantic 스키마
8차 스프린트: 답변(AnswerOut) + 요약 확장 + 아이템 hasAnswer 추가
GET /api/inquiries, GET /api/inquiries/{id}, PATCH /api/inquiries/{id}/read
POST/PATCH/DELETE /api/inquiries/{id}/answer
"""

from datetime import datetime

from pydantic import BaseModel


# ── 답변 작성자 ────────────────────────────────────────────────────────────────

class AnswerAuthorOut(BaseModel):
    id:   int
    name: str
    role: str
    model_config = {"from_attributes": True}


# ── 직원용 답변 ────────────────────────────────────────────────────────────────

class AnswerOut(BaseModel):
    id:        int
    inquiryId: int
    content:   str
    author:    AnswerAuthorOut
    createdAt: datetime
    updatedAt: datetime
    canEdit:   bool = False
    model_config = {"from_attributes": True}


# ── 답변 요청 ──────────────────────────────────────────────────────────────────

class AnswerCreateRequest(BaseModel):
    content: str


class AnswerUpdateRequest(BaseModel):
    content: str


# ── 답변 생성 응답 ─────────────────────────────────────────────────────────────

class AnswerCreateResponse(BaseModel):
    answer:        AnswerOut
    inquiryStatus: str


# ── 기존 스키마 ────────────────────────────────────────────────────────────────

class InquiryGuardianOut(BaseModel):
    id:    int
    name:  str
    phone: str | None = None
    model_config = {"from_attributes": True}


class InquiryResidentOut(BaseModel):
    id:           int
    name:         str
    roomNumber:   str | None = None
    careLevel:    str | None = None
    precautions:  str | None = None
    model_config = {"from_attributes": True}


class StaffInquiryItemOut(BaseModel):
    id:                 int
    category:           str
    preview:            str
    guardianName:       str
    residentName:       str
    residentRoomNumber: str | None = None
    status:             str
    hasAnswer:          bool = False   # 8차 추가
    createdAt:          datetime
    model_config = {"from_attributes": True}


class InquirySummaryOut(BaseModel):
    unread:      int
    needsAnswer: int = 0   # 8차 추가 (READ 카운트)
    answered:    int = 0   # 8차 추가 (ANSWERED 카운트)
    byCategory:  dict[str, int]


class StaffInquiryListResponse(BaseModel):
    total:   int
    summary: InquirySummaryOut
    items:   list[StaffInquiryItemOut]


class StaffInquiryDetailOut(BaseModel):
    id:        int
    category:  str
    title:     str | None = None
    content:   str
    status:    str
    guardian:  InquiryGuardianOut
    resident:  InquiryResidentOut
    answer:    AnswerOut | None = None   # 8차 추가
    createdAt: datetime
    readBy:    int | None = None
    readAt:    datetime | None = None
    model_config = {"from_attributes": True}


class StaffInquiryDetailResponse(BaseModel):
    inquiry: StaffInquiryDetailOut


class InquiryReadOut(BaseModel):
    id:     int
    status: str
    readAt: datetime | None = None
    model_config = {"from_attributes": True}


class InquiryReadResponse(BaseModel):
    inquiry: InquiryReadOut

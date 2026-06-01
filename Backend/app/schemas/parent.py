"""
5차 스프린트: 보호자 채널 Pydantic 스키마
8차 스프린트: 답변(ParentAnswerOut) + 목록 hasNewAnswer + 홈 카운트 추가
GET /api/parent/* 응답 전용
"""

from datetime import datetime

from pydantic import BaseModel


# ── /api/parent/me ────────────────────────────────────────────────────────────

class ParentUserOut(BaseModel):
    id:    int
    name:  str
    email: str
    role:  str
    model_config = {"from_attributes": True}


class ParentResidentOut(BaseModel):
    id:           int
    name:         str
    age:          int
    roomNumber:   str | None = None
    careLevel:    str | None = None
    relationship: str | None = None
    model_config = {"from_attributes": True}


class ParentMealsSummaryOut(BaseModel):
    todayRegisteredCount: int


class ParentScheduleSummaryOut(BaseModel):
    thisMonthCount: int


# 7차 추가
class ParentAlbumsSummaryOut(BaseModel):
    myResidentInThisMonth: int


class ParentSummaryOut(BaseModel):
    unreadBoardCount:       int
    unreadNoticeCount:      int
    newReportCount:         int
    pendingInquiryCount:    int
    inquiryNewAnswerCount:  int = 0   # 8차 추가
    # 6차 추가
    meals:    ParentMealsSummaryOut    = ParentMealsSummaryOut(todayRegisteredCount=0)
    schedule: ParentScheduleSummaryOut = ParentScheduleSummaryOut(thisMonthCount=0)
    # 7차 추가
    albums:   ParentAlbumsSummaryOut   = ParentAlbumsSummaryOut(myResidentInThisMonth=0)


class ParentMeResponse(BaseModel):
    user:      ParentUserOut
    residents: list[ParentResidentOut]
    summary:   ParentSummaryOut


# ── /api/parent/board ─────────────────────────────────────────────────────────

class ParentBoardItemOut(BaseModel):
    id:        int
    title:     str
    preview:   str
    createdAt: datetime
    canEdit:   bool = False       # 보호자는 항상 false
    model_config = {"from_attributes": True}


class ParentBoardListResponse(BaseModel):
    total: int
    items: list[ParentBoardItemOut]


class ParentBoardDetailOut(BaseModel):
    id:        int
    title:     str
    content:   str
    createdAt: datetime
    updatedAt: datetime
    canEdit:   bool = False
    model_config = {"from_attributes": True}


class ParentBoardDetailResponse(BaseModel):
    post: ParentBoardDetailOut


# ── /api/parent/notices ───────────────────────────────────────────────────────

class ParentNoticeItemOut(BaseModel):
    id:           int
    residentId:   int
    residentName: str
    preview:      str
    sentAt:       datetime | None = None
    readAt:       datetime | None = None
    model_config = {"from_attributes": True}


class ParentNoticeListResponse(BaseModel):
    total: int
    items: list[ParentNoticeItemOut]


class ParentNoticeStructuredStatus(BaseModel):
    health: str
    mood: str
    meal: str
    medication: str | None = None

class ParentNoticeDetailOut(BaseModel):
    id:           int
    residentName: str
    finalText:    str | None = None
    structuredStatus: ParentNoticeStructuredStatus | None = None
    sentAt:       datetime | None = None
    readAt:       datetime | None = None
    model_config = {"from_attributes": True}


class ParentNoticeDetailResponse(BaseModel):
    notice: ParentNoticeDetailOut


# ── /api/parent/reports ───────────────────────────────────────────────────────

class ParentReportItemOut(BaseModel):
    id:           int
    residentId:   int
    residentName: str
    preview:      str
    sentAt:       datetime | None = None
    readAt:       datetime | None = None
    model_config = {"from_attributes": True}


class ParentReportListResponse(BaseModel):
    total: int
    items: list[ParentReportItemOut]


class ParentReportWeekStats(BaseModel):
    recordedDays: int
    topMood: str
    topMeal: str

class ParentReportDetailOut(BaseModel):
    id:           int
    residentName: str
    finalText:    str | None = None
    weekStats:    ParentReportWeekStats | None = None
    sentAt:       datetime | None = None
    readAt:       datetime | None = None
    model_config = {"from_attributes": True}


class ParentReportDetailResponse(BaseModel):
    report: ParentReportDetailOut


# ── /api/parent/inquiries ─────────────────────────────────────────────────────

class InquiryCreateRequest(BaseModel):
    residentId: int
    title:      str | None = None
    content:    str


# 8차: 보호자용 답변 작성자 (id 제외)
class ParentAnswerAuthorOut(BaseModel):
    name: str
    role: str


# 8차: 보호자용 답변
class ParentAnswerOut(BaseModel):
    content:   str
    author:    ParentAnswerAuthorOut
    createdAt: datetime


class ParentInquiryItemOut(BaseModel):
    id:            int
    category:      str
    preview:       str
    status:        str
    createdAt:     datetime
    hasNewAnswer:  bool = False         # 8차 추가
    answerPreview: str | None = None    # 8차 추가
    model_config = {"from_attributes": True}


class ParentInquiryListResponse(BaseModel):
    total: int
    items: list[ParentInquiryItemOut]


class ParentInquiryDetailOut(BaseModel):
    id:        int
    category:  str
    title:     str | None = None
    content:   str
    status:    str
    createdAt: datetime
    answer:    ParentAnswerOut | None = None   # 8차 추가
    model_config = {"from_attributes": True}


class ParentInquiryDetailResponse(BaseModel):
    inquiry: ParentInquiryDetailOut


class InquiryCreatedOut(BaseModel):
    id:        int
    category:  str
    status:    str
    createdAt: datetime
    model_config = {"from_attributes": True}


class InquiryCreateResponse(BaseModel):
    inquiry: InquiryCreatedOut

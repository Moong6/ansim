"""
POST /api/notices/generate  요청/응답 스키마
POST /api/notices/send      요청/응답 스키마
POST /api/notices/refine    요청/응답 스키마
GET  /api/notices/{id}      응답 스키마
"""

from typing import Literal
from pydantic import BaseModel, Field


# ─── 요청 ─────────────────────────────────────────────────────────────────────

class StructuredStatus(BaseModel):
    health:     Literal["GOOD", "NORMAL", "NEEDS_OBSERVATION"]
    mood:       Literal["GOOD", "NORMAL", "ANXIOUS"]
    meal:       Literal["FULL", "NORMAL", "LITTLE", "REFUSED"]
    medication: Literal["DONE", "NONE"]


class GenerateRequest(BaseModel):
    residentId:             int
    participatedProgramIds: list[int] = Field(default_factory=list)
    status:                 StructuredStatus
    memo:                   str = ""
    tone:                   Literal["FRIENDLY", "POLITE", "EMPATHETIC"] = "POLITE"
    # 2차: 메모 입력 언어. None 이면 서버에서 자동 감지.
    memoLang:               str | None = None


# ─── 응답 ─────────────────────────────────────────────────────────────────────

class DraftOut(BaseModel):
    index: int          # 0 / 1 / 2
    label: str          # "A" | "B" | "C"
    text:  str


class AppliedProgram(BaseModel):
    programId: int
    title:     str
    startTime: str      # "HH:MM"


class GenerateResponse(BaseModel):
    drafts:          list[DraftOut]
    softenedCount:   int
    appliedPrograms: list[AppliedProgram]
    # 2차: 감지된 메모 입력 언어 (ko/vi/zh/en/기타)
    detectedLang:    str


# =============================================================================
# POST /api/notices/send
# =============================================================================

class SendRequest(BaseModel):
    residentId:             int
    rawMemo:                str = ""
    status:                 StructuredStatus
    participatedProgramIds: list[int] = Field(default_factory=list)
    tone:                   Literal["FRIENDLY", "POLITE", "EMPATHETIC"]
    aiGeneratedTexts:       list[DraftOut] = Field(min_length=1)   # 3안 전체 보존
    selectedDraftIndex:     int = Field(ge=0, le=2)                # 0/1/2
    isRefined:              bool
    finalText:              str = Field(min_length=1)              # 발송 본문 (필수)
    previousNoticeId:       int | None = None                       # 재전송이면 직전 notice id
    # 2차: 이 알림장 메모의 입력 언어 (notice.memo_lang 에 저장)
    memoLang:               str = "ko"


class NoticeSentOut(BaseModel):
    id:       int
    version:  int
    status:   Literal["SENT"]
    isEdited: bool
    sentAt:   str        # ISO 8601


class SendResponse(BaseModel):
    notice: NoticeSentOut


# =============================================================================
# POST /api/notices/refine
# =============================================================================

class RefineRequest(BaseModel):
    text: str = Field(min_length=1)
    tone: Literal["FRIENDLY", "POLITE", "EMPATHETIC"] = "POLITE"


class RefineResponse(BaseModel):
    refinedText: str
    changed:     bool


# =============================================================================
# GET /api/notices/{id}
# =============================================================================

class NoticeDetailOut(BaseModel):
    id:                   int
    residentId:           int
    version:              int
    status:               Literal["DRAFT", "SENT"]
    isEdited:             bool
    structuredStatus:     dict                    # JSONB 그대로
    participatedPrograms: list                    # JSONB 그대로 [{program_id,title,start_time}]
    rawMemo:              str | None
    tone:                 Literal["FRIENDLY", "POLITE", "EMPATHETIC"]
    selectedDraftIndex:   int | None
    isRefined:            bool
    finalText:            str | None
    sentAt:               str | None              # ISO 8601
    readAt:               str | None              # ISO 8601


class NoticeDetailResponse(BaseModel):
    notice: NoticeDetailOut

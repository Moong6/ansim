"""
GET  /api/reports/preview   응답 스키마
POST /api/reports/generate  요청/응답 스키마
POST /api/reports/send      요청/응답 스키마
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Tone = Literal["FRIENDLY", "POLITE", "EMPATHETIC"]


# ─── 데이터 부족 분기 ────────────────────────────────────────────────────────
# 0일      → NONE        (generate 차단, AI 호출 안 함)
# 1~2일    → SPARSE      (사용자 확인 후 진행, 프롬프트에 N일치 명시)
# 3일 이상 → SUFFICIENT  (정상 생성)
DataLevel = Literal["NONE", "SPARSE", "SUFFICIENT"]


# ─── 통계 요약 ────────────────────────────────────────────────────────────────

class TopProgram(BaseModel):
    title: str
    count: int


class StatsSummary(BaseModel):
    recordedDays: int                       # 0~7
    meal:   dict[str, int] = Field(default_factory=dict)   # {"FULL":n, "NORMAL":n, "LITTLE":n, "REFUSED":n}
    mood:   dict[str, int] = Field(default_factory=dict)   # {"GOOD":n, "NORMAL":n, "ANXIOUS":n}
    health: dict[str, int] = Field(default_factory=dict)   # {"GOOD":n, "NORMAL":n, "NEEDS_OBSERVATION":n}
    topPrograms: list[TopProgram] = Field(default_factory=list)


# ─── /preview 응답 ───────────────────────────────────────────────────────────

class PreviewResponse(BaseModel):
    residentId:     int
    periodStart:    date            # 월요일
    periodEnd:      date            # 일요일
    recordedDays:   int
    dataLevel:      DataLevel
    statsSummary:   StatsSummary
    sourceNoticeIds: list[int]      # 집계에 사용된 notice id (검증/추적용)


# =============================================================================
# POST /api/reports/generate
# =============================================================================

class GenerateReportRequest(BaseModel):
    residentId:  int
    periodStart: date                # 월요일
    tone:        Tone = "POLITE"


class GenerateReportResponse(BaseModel):
    residentId:     int
    periodStart:    date
    periodEnd:      date
    recordedDays:   int
    reportText:     str              # AI 생성 본문 (한국어 단일 편지)
    statsSummary:   StatsSummary
    sourceNoticeIds: list[int]


# =============================================================================
# POST /api/reports/send
# =============================================================================

class SendReportRequest(BaseModel):
    residentId:      int
    periodStart:     date
    periodEnd:       date
    recordedDays:    int = Field(ge=1, le=7)        # 0일은 generate 에서 막혔어야 함
    tone:            Tone
    statsSummary:    StatsSummary
    sourceNoticeIds: list[int]                       # 서버에서 재검증
    aiGeneratedText: str | None = None               # AI 원본 (보존)
    finalText:       str = Field(min_length=1)       # 직원 편집본 (발송본)


class ReportSentOut(BaseModel):
    id:     int
    status: Literal["SENT"]
    sentAt: str                       # ISO 8601


class SendReportResponse(BaseModel):
    report: ReportSentOut

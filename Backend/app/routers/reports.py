"""
주간 안심 리포트 라우터

  GET  /api/reports/preview     주차 데이터 집계 + dataLevel (LLM 호출 X)
  POST /api/reports/generate    AI 편지 생성 (LLM 1회)
  POST /api/reports/send        report 행 INSERT + 발송 (append-only 미적용, 단순 INSERT)
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date as SADate, cast, select
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.core.permissions import assert_assigned
from app.db.session import get_db
from app.models.models import AppUser, Notice, NoticeStatus, NoticeTone, Resident
from app.models.report import Report
from app.schemas.reports import (
    GenerateReportRequest,
    GenerateReportResponse,
    PreviewResponse,
    ReportSentOut,
    SendReportRequest,
    SendReportResponse,
    StatsSummary,
    TopProgram,
)
from app.services.gemini_service import GeminiServiceError
from app.services.report_service import (
    classify_data_level,
    compute_stats,
    fetch_week_current_notices,
    generate_weekly_letter,
)


# ─── 공통 헬퍼 ────────────────────────────────────────────────────────────────

def _assert_monday(period_start: date) -> None:
    """월요일이 아니면 400 INVALID_PERIOD."""
    if period_start.weekday() != 0:    # 월=0
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_PERIOD",
                "message": "periodStart 는 월요일 날짜여야 합니다.",
            },
        )


def _assert_resident_accessible(
    db: Session, user_id: int, resident_id: int
) -> Resident:
    """어르신 존재 + 담당 검증. 통과하면 Resident 인스턴스 반환."""
    resident = db.get(Resident, resident_id)
    if resident is None or resident.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESIDENT_NOT_FOUND", "message": "어르신을 찾을 수 없습니다."},
        )
    assert_assigned(db, user_id, resident_id)
    return resident

router = APIRouter(prefix="/api/reports", tags=["reports"])


# =============================================================================
# GET /api/reports/preview
# =============================================================================

@router.get("/preview", response_model=PreviewResponse)
def preview_report(
    residentId: int = Query(..., description="대상 어르신 ID"),
    periodStart: date = Query(..., description="주 시작일 — 반드시 월요일 (YYYY-MM-DD)"),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> PreviewResponse:
    """
    한 주의 알림장을 집계해 dataLevel · 통계 · 근거 notice id 를 반환.
    AI 호출 없음 (LLM 비용 0).

    절차:
      1) periodStart 가 월요일인지 검증 → 아니면 400 INVALID_PERIOD
      2) 어르신 존재 확인 → 없으면 404 RESIDENT_NOT_FOUND
      3) 담당 여부 검증 → 아니면 403 FORBIDDEN
      4) 해당 주의 SENT 알림장을 root 그룹별 MAX version 으로 조회
      5) structured_status + programs 집계 → stats_summary
      6) recordedDays 로 dataLevel 분류
    """
    # 1) 월요일 검증
    _assert_monday(periodStart)

    # 2~3) 어르신 + 담당 검증
    _assert_resident_accessible(db, current_user.id, residentId)

    # 4) 해당 주 알림장 (root 그룹별 최신본)
    notices = fetch_week_current_notices(db, residentId, periodStart)

    # 5) 코드 집계
    stats = compute_stats(notices)
    period_end = periodStart + timedelta(days=6)
    data_level = classify_data_level(stats["recordedDays"])

    return PreviewResponse(
        residentId=residentId,
        periodStart=periodStart,
        periodEnd=period_end,
        recordedDays=stats["recordedDays"],
        dataLevel=data_level,
        statsSummary=StatsSummary(
            recordedDays=stats["recordedDays"],
            meal=stats["meal"],
            mood=stats["mood"],
            health=stats["health"],
            topPrograms=[TopProgram(**t) for t in stats["topPrograms"]],
        ),
        sourceNoticeIds=[n.id for n in notices],
    )


# =============================================================================
# POST /api/reports/generate  — AI 편지 생성 (LLM 1회, DB 미저장)
# =============================================================================

@router.post("/generate", response_model=GenerateReportResponse)
def generate_report(
    body: GenerateReportRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> GenerateReportResponse:
    """
    한 주의 알림장 데이터를 모아 Gemini 로 단일 종합 편지를 생성한다.

    절차:
      1) periodStart 월요일 검증
      2) 어르신 + 담당 검증
      3) 해당 주 notice 집계 (preview 와 동일 로직)
      4) ★ recordedDays == 0 이면 422 NO_DATA — LLM 호출 안 함 (낭비 차단)
      5) precautions 주입 + N일치 명시 프롬프트 → Gemini Structured Output
      6) 한국어 단일 편지 반환. DB 저장은 /send 에서.
    """
    # 1) 월요일 검증
    _assert_monday(body.periodStart)

    # 2~3) 어르신 + 담당
    resident = _assert_resident_accessible(db, current_user.id, body.residentId)

    # 4) 주차 notice 집계
    notices = fetch_week_current_notices(db, body.residentId, body.periodStart)
    stats = compute_stats(notices)
    recorded_days = stats["recordedDays"]

    # ★ 0일 차단 — AI 호출 전. 프론트가 막아도 서버에서 한 번 더.
    if recorded_days == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "NO_DATA",
                "message": "해당 주에 작성된 알림장이 없어 편지를 생성할 수 없습니다.",
            },
        )

    # 5) Gemini 호출
    period_end = body.periodStart + timedelta(days=6)
    try:
        report_text = generate_weekly_letter(
            resident=resident,
            period_start=body.periodStart,
            period_end=period_end,
            recorded_days=recorded_days,
            stats=stats,
            notices=notices,
            tone=body.tone,
        )
    except GeminiServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "LLM_ERROR", "message": str(e)},
        )

    # 6) 응답 — DB 저장은 /send 단계에서
    return GenerateReportResponse(
        residentId=body.residentId,
        periodStart=body.periodStart,
        periodEnd=period_end,
        recordedDays=recorded_days,
        reportText=report_text,
        statsSummary=StatsSummary(
            recordedDays=recorded_days,
            meal=stats["meal"],
            mood=stats["mood"],
            health=stats["health"],
            topPrograms=[TopProgram(**t) for t in stats["topPrograms"]],
        ),
        sourceNoticeIds=[n.id for n in notices],
    )


# =============================================================================
# POST /api/reports/send  — INSERT + 발송 (append-only 미적용, 단순 INSERT)
# =============================================================================

@router.post(
    "/send",
    response_model=SendReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_report(
    body: SendReportRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> SendReportResponse:
    """
    리포트 행을 INSERT 한다 (status=SENT, sent_at=now).

    ★ 보안 핵심:
      sourceNoticeIds 가 실제로 해당 어르신·해당 주차의 SENT notice 인지
      서버에서 재검증한다. 클라이언트가 다른 어르신·다른 주의 id 를 섞어도
      여기서 차단 (400 INVALID_SOURCE_NOTICES).
    """
    # 1) 월요일 검증
    _assert_monday(body.periodStart)

    # 1-1) periodEnd 가 정확히 periodStart + 6일인지
    expected_end = body.periodStart + timedelta(days=6)
    if body.periodEnd != expected_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_PERIOD",
                "message": "periodEnd 가 periodStart + 6일(일요일) 과 일치하지 않습니다.",
            },
        )

    # 2~3) 어르신 + 담당
    _assert_resident_accessible(db, current_user.id, body.residentId)

    # 4) ★ sourceNoticeIds 서버 재검증 — 보안 (클라이언트 신뢰 금지)
    if body.sourceNoticeIds:
        # 요청된 id 중 "이 어르신 + 이 주차 + SENT + 활성" 조건을 만족하는 것만
        valid = set(
            db.scalars(
                select(Notice.id)
                .where(Notice.id.in_(body.sourceNoticeIds))
                .where(Notice.resident_id == body.residentId)
                .where(Notice.status == NoticeStatus.SENT)
                .where(Notice.deleted_at.is_(None))
                .where(cast(Notice.sent_at, SADate) >= body.periodStart)
                .where(cast(Notice.sent_at, SADate) <= body.periodEnd)
            ).all()
        )
        requested = set(body.sourceNoticeIds)
        if valid != requested:
            invalid = sorted(requested - valid)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_SOURCE_NOTICES",
                    "message": (
                        f"근거 notice id 검증 실패: {invalid} 가 해당 어르신·주차의 "
                        f"SENT 알림장에 속하지 않습니다."
                    ),
                },
            )

    # 5) INSERT (append-only 적용 안 함 — 단순 INSERT)
    report = Report(
        resident_id       = body.residentId,
        author_id         = current_user.id,
        period_start      = body.periodStart,
        period_end        = body.periodEnd,
        recorded_days     = body.recordedDays,
        stats_summary     = body.statsSummary.model_dump(),
        source_notice_ids = list(body.sourceNoticeIds),
        tone              = NoticeTone(body.tone),
        ai_generated_text = body.aiGeneratedText,    # AI 원본 보존
        final_text        = body.finalText,          # 직원 편집본 (UPDATE 금지)
        status            = NoticeStatus.SENT,
        sent_at           = datetime.now(timezone.utc),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return SendReportResponse(
        report=ReportSentOut(
            id=report.id,
            status="SENT",
            sentAt=report.sent_at.isoformat(),
        )
    )

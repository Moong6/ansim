"""
POST /api/notices/generate  — AI 3초안 생성 (Stateless, DB 미저장)

서버 로직 순서:
  1) residentId → resident 조회 (없으면 404)
  2) 담당 매핑 검증 → 다른 직원의 어르신이면 403
  3) participatedProgramIds → 같은 시설의 프로그램만 조회
  4) gemini_service 호출 (precautions 주입 + Structured Output)
  5) 실패 시 502 LLM_ERROR
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.core.permissions import assert_assigned
from app.db.session import get_db
from app.models.models import (
    AppUser,
    Notice,
    NoticeStatus,
    NoticeTone,
    Program,
    Resident,
)
from app.schemas.notices import (
    AppliedProgram,
    GenerateRequest,
    GenerateResponse,
    NoticeDetailOut,
    NoticeDetailResponse,
    NoticeSentOut,
    RefineRequest,
    RefineResponse,
    SendRequest,
    SendResponse,
)
from app.schemas.users import ALLOWED_LANGS
from app.services.gemini_service import (
    GeminiServiceError,
    generate_drafts,
    refine_text,
)

router = APIRouter(prefix="/api/notices", tags=["notices"])


@router.post("/generate", response_model=GenerateResponse)
def generate_notice_drafts(
    body: GenerateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> GenerateResponse:

    # ── 1. 어르신 조회 ────────────────────────────────────────────────────────
    resident = db.get(Resident, body.residentId)
    if resident is None or resident.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESIDENT_NOT_FOUND", "message": "어르신을 찾을 수 없습니다"},
        )

    # ── 2. 담당 여부 검증 ─────────────────────────────────────────────────────
    assert_assigned(db, current_user.id, body.residentId)

    # ── 3. 참여 프로그램 조회 (같은 시설로 한정) ──────────────────────────────
    programs: list[Program] = []
    if body.participatedProgramIds:
        programs = list(
            db.scalars(
                select(Program)
                .where(Program.id.in_(body.participatedProgramIds))
                .where(Program.facility_id == current_user.facility_id)
                .where(Program.deleted_at.is_(None))
                .order_by(Program.start_time.asc().nulls_last())
            )
        )

    # ── 4. memoLang 검증 (2차) ───────────────────────────────────────────────
    if body.memoLang is not None and body.memoLang not in ALLOWED_LANGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_LANGUAGE",
                "message": f"지원하지 않는 언어 코드입니다. 허용: {sorted(ALLOWED_LANGS)}",
            },
        )

    # ── 5. Gemini 호출 (memo_lang 전달) ─────────────────────────────────────
    try:
        drafts, softened_count, detected_lang = generate_drafts(
            resident=resident,
            programs=programs,
            status=body.status,
            memo=body.memo,
            tone=body.tone,
            memo_lang=body.memoLang,
        )
    except GeminiServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "LLM_ERROR", "message": str(e)},
        )

    return GenerateResponse(
        drafts=drafts,
        softenedCount=softened_count,
        appliedPrograms=[
            AppliedProgram(
                programId=p.id,
                title=p.title,
                startTime=p.start_time.strftime("%H:%M") if p.start_time else "",
            )
            for p in programs
        ],
        detectedLang=detected_lang,
    )


# =============================================================================
# POST /api/notices/send  — 전송 / 재전송 (Append-only INSERT, UPDATE 금지)
# =============================================================================

def _snapshot_programs(
    db: Session, facility_id: int, program_ids: list[int]
) -> list[dict]:
    """체크된 프로그램을 같은 시설로 한정해 조회 → JSONB 저장용 스냅샷 생성."""
    if not program_ids:
        return []
    rows = db.scalars(
        select(Program)
        .where(Program.id.in_(program_ids))
        .where(Program.facility_id == facility_id)
        .where(Program.deleted_at.is_(None))
        .order_by(Program.start_time.asc().nulls_last())
    ).all()
    return [
        {
            "program_id": p.id,
            "title":      p.title,
            "start_time": p.start_time.strftime("%H:%M") if p.start_time else None,
        }
        for p in rows
    ]


@router.post(
    "/send",
    response_model=SendResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_notice(
    body: SendRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> SendResponse:
    """
    전송 / 재전송 처리. 항상 INSERT (append-only). UPDATE 절대 금지.

    동작:
      - previousNoticeId is None → version=1, root_notice_id=None, is_edited=False
      - previousNoticeId 있음    → 그 notice의 root를 찾아 version=MAX+1, root=root, is_edited=True
    """

    # ── 1. 어르신 조회 ────────────────────────────────────────────────────────
    resident = db.get(Resident, body.residentId)
    if resident is None or resident.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESIDENT_NOT_FOUND", "message": "어르신을 찾을 수 없습니다"},
        )

    # ── 2. 담당 여부 검증 ─────────────────────────────────────────────────────
    assert_assigned(db, current_user.id, body.residentId)

    # ── 3. 버전/루트 결정 ─────────────────────────────────────────────────────
    new_root_id: int | None
    new_version: int
    is_edited:   bool

    if body.previousNoticeId is None:
        # 최초 전송
        new_root_id = None
        new_version = 1
        is_edited   = False
    else:
        # 재전송 — 직전 notice 조회 후 루트 결정
        prev = db.get(Notice, body.previousNoticeId)
        if prev is None or prev.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "PREVIOUS_NOTICE_NOT_FOUND",
                    "message": "직전 알림장을 찾을 수 없습니다",
                },
            )
        if prev.resident_id != body.residentId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "previousNoticeId가 요청 residentId와 일치하지 않습니다",
                },
            )

        # 루트 = prev 자신이 루트면 prev.id, 아니면 prev.root_notice_id
        new_root_id = prev.root_notice_id or prev.id

        # 같은 root 그룹의 MAX(version) + 1
        max_v: int | None = db.scalar(
            select(func.max(Notice.version))
            .where(
                or_(
                    Notice.id == new_root_id,
                    Notice.root_notice_id == new_root_id,
                )
            )
            .where(Notice.deleted_at.is_(None))
        )
        new_version = (max_v or 0) + 1
        is_edited   = True

    # ── 4. 프로그램 스냅샷 ────────────────────────────────────────────────────
    programs_snapshot = _snapshot_programs(
        db, current_user.facility_id, body.participatedProgramIds
    )

    # ── 4-1. memoLang 검증 (2차) ──────────────────────────────────────────────
    if body.memoLang not in ALLOWED_LANGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_LANGUAGE",
                "message": f"지원하지 않는 언어 코드입니다. 허용: {sorted(ALLOWED_LANGS)}",
            },
        )

    # ── 5. INSERT (append-only) ───────────────────────────────────────────────
    notice = Notice(
        resident_id           = body.residentId,
        author_id             = current_user.id,
        root_notice_id        = new_root_id,
        version               = new_version,
        structured_status     = body.status.model_dump(),
        participated_programs = programs_snapshot,
        raw_memo              = body.rawMemo,
        tone                  = NoticeTone(body.tone),
        ai_generated_texts    = [d.model_dump() for d in body.aiGeneratedTexts],
        selected_draft_index  = body.selectedDraftIndex,
        is_refined            = body.isRefined,
        final_polished_text   = body.finalText,
        status                = NoticeStatus.SENT,
        is_edited             = is_edited,
        sent_at               = datetime.now(timezone.utc),
        memo_lang             = body.memoLang,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)

    # ── 6. 응답 ───────────────────────────────────────────────────────────────
    return SendResponse(
        notice=NoticeSentOut(
            id       = notice.id,
            version  = notice.version,
            status   = "SENT",
            isEdited = notice.is_edited,
            sentAt   = notice.sent_at.isoformat(),
        )
    )


# =============================================================================
# POST /api/notices/refine  — 맞춤법·표현 다듬기 (Stateless)
# =============================================================================

@router.post("/refine", response_model=RefineResponse)
def refine_notice_text(
    body: RefineRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> RefineResponse:
    """
    맞춤법·띄어쓰기 교정 + 자극적·딱딱한 표현 순화.
    내용 추가/삭제/재구성 금지 (프롬프트 강제).

    1회 제한은 프론트엔드 UX 책임 (서버는 상태 미보유).
    """
    try:
        refined = refine_text(text=body.text, tone=body.tone)
    except GeminiServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "LLM_ERROR", "message": str(e)},
        )

    changed = refined.strip() != body.text.strip()
    return RefineResponse(refinedText=refined, changed=changed)


# =============================================================================
# GET /api/notices/{notice_id}  — 단건 조회 (읽기 전용 / 재전송 복원용)
# =============================================================================

@router.get("/{notice_id}", response_model=NoticeDetailResponse)
def get_notice(
    notice_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> NoticeDetailResponse:

    notice = db.get(Notice, notice_id)
    if notice is None or notice.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOTICE_NOT_FOUND", "message": "알림장을 찾을 수 없습니다"},
        )

    # 담당 어르신의 알림장만 조회 가능
    assert_assigned(db, current_user.id, notice.resident_id)

    return NoticeDetailResponse(
        notice=NoticeDetailOut(
            id                   = notice.id,
            residentId           = notice.resident_id,
            version              = notice.version,
            status               = notice.status.value,
            isEdited             = notice.is_edited,
            structuredStatus     = notice.structured_status,
            participatedPrograms = notice.participated_programs,
            rawMemo              = notice.raw_memo,
            tone                 = notice.tone.value,
            selectedDraftIndex   = notice.selected_draft_index,
            isRefined            = notice.is_refined,
            finalText            = notice.final_polished_text,
            sentAt               = notice.sent_at.isoformat() if notice.sent_at else None,
            readAt               = notice.read_at.isoformat() if notice.read_at else None,
        )
    )

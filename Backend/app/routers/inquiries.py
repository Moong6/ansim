"""
5차 스프린트: 직원 문의 처리 API
8차 스프린트: 답변 CRUD + 5차 응답 확장

  GET   /api/inquiries              목록 (카테고리/상태 필터, 정렬 확장)
  GET   /api/inquiries/{id}         상세 (answer 포함)
  PATCH /api/inquiries/{id}/read    확인 완료 (idempotent)
  POST  /api/inquiries/{id}/answer  답변 등록 (READ 상태에서만, 트랜잭션)
  PATCH /api/inquiries/{id}/answer  답변 수정 (작성자·ADMIN)
  DELETE /api/inquiries/{id}/answer 답변 삭제 (작성자·ADMIN, 트랜잭션 → READ)

모든 엔드포인트: require_staff 적용.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.inquiry import Inquiry, InquiryAnswer, InquiryCategory, InquiryStatus
from app.models.models import AppUser, Guardian, Resident, UserRole
from app.schemas.inquiries import (
    AnswerAuthorOut,
    AnswerCreateRequest,
    AnswerCreateResponse,
    AnswerOut,
    AnswerUpdateRequest,
    InquiryGuardianOut,
    InquiryReadOut,
    InquiryReadResponse,
    InquiryResidentOut,
    InquirySummaryOut,
    StaffInquiryDetailOut,
    StaffInquiryDetailResponse,
    StaffInquiryItemOut,
    StaffInquiryListResponse,
)

router = APIRouter(prefix="/api/inquiries", tags=["inquiries"])


# ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _can_edit_answer(answer: InquiryAnswer, user: AppUser) -> bool:
    return answer.author_id == user.id or user.role == UserRole.ADMIN


def _build_answer_out(answer: InquiryAnswer, user: AppUser) -> AnswerOut:
    return AnswerOut(
        id=answer.id,
        inquiryId=answer.inquiry_id,
        content=answer.content,
        author=AnswerAuthorOut(
            id=answer.author.id,
            name=answer.author.name,
            role=answer.author.role.value,
        ),
        createdAt=answer.created_at,
        updatedAt=answer.updated_at,
        canEdit=_can_edit_answer(answer, user),
    )


def _get_active_answer(db: Session, inquiry_id: int) -> InquiryAnswer | None:
    return db.scalars(
        select(InquiryAnswer)
        .where(InquiryAnswer.inquiry_id == inquiry_id)
        .where(InquiryAnswer.deleted_at.is_(None))
    ).first()


# ─── GET /api/inquiries ───────────────────────────────────────────────────────

@router.get("", response_model=StaffInquiryListResponse)
def list_inquiries(
    category: str | None = Query(None),
    status_filter: InquiryStatus | None = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> StaffInquiryListResponse:

    base = (
        select(Inquiry)
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.deleted_at.is_(None))
    )
    if category:
        try:
            cat_enum = InquiryCategory(category)
            base = base.where(Inquiry.category == cat_enum)
        except ValueError:
            pass
    if status_filter:
        base = base.where(Inquiry.status == status_filter)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    # 8차: UNREAD→READ→ANSWERED 순, 그 안 최신순
    sort_order = case(
        (Inquiry.status == InquiryStatus.UNREAD, 0),
        (Inquiry.status == InquiryStatus.READ, 1),
        else_=2,
    )
    rows = db.scalars(
        base
        .order_by(sort_order, Inquiry.created_at.desc())
        .limit(limit).offset(offset)
    ).all()

    # summary
    unread_count = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.status == InquiryStatus.UNREAD)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    # 8차: needsAnswer (READ), answered (ANSWERED)
    needs_answer_count = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.status == InquiryStatus.READ)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    answered_count = db.scalar(
        select(func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.status == InquiryStatus.ANSWERED)
        .where(Inquiry.deleted_at.is_(None))
    ) or 0

    by_category: dict[str, int] = {c.value: 0 for c in InquiryCategory}
    for cat_val, cnt in db.execute(
        select(Inquiry.category, func.count(Inquiry.id))
        .where(Inquiry.facility_id == current_user.facility_id)
        .where(Inquiry.deleted_at.is_(None))
        .group_by(Inquiry.category)
    ).all():
        by_category[cat_val.value] = cnt

    items = []
    for inq in rows:
        guardian = db.get(AppUser, inq.guardian_user_id)
        resident = db.get(Resident, inq.resident_id)
        items.append(StaffInquiryItemOut(
            id=inq.id,
            category=inq.category.value,
            preview=(inq.content or "")[:80],
            guardianName=guardian.name if guardian else "",
            residentName=resident.name if resident else "",
            residentRoomNumber=resident.room_number if resident else None,
            status=inq.status.value,
            hasAnswer=(inq.status == InquiryStatus.ANSWERED),  # 8차
            createdAt=inq.created_at,
        ))

    return StaffInquiryListResponse(
        total=total,
        summary=InquirySummaryOut(
            unread=unread_count,
            needsAnswer=needs_answer_count,
            answered=answered_count,
            byCategory=by_category,
        ),
        items=items,
    )


# ─── GET /api/inquiries/{id} ─────────────────────────────────────────────────

@router.get("/{inquiry_id}", response_model=StaffInquiryDetailResponse)
def get_inquiry_detail(
    inquiry_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> StaffInquiryDetailResponse:

    inq = db.get(Inquiry, inquiry_id)
    if not inq or inq.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "문의가 없습니다"})
    if inq.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    guardian_user = db.get(AppUser, inq.guardian_user_id)
    guardian_row = db.scalars(
        select(Guardian)
        .where(Guardian.user_id == inq.guardian_user_id)
        .where(Guardian.resident_id == inq.resident_id)
        .where(Guardian.deleted_at.is_(None))
    ).first()
    resident = db.get(Resident, inq.resident_id)

    guardian_out = InquiryGuardianOut(
        id=inq.guardian_user_id,
        name=guardian_user.name if guardian_user else "",
        phone=guardian_row.phone if guardian_row else None,
    )
    resident_out = InquiryResidentOut(
        id=inq.resident_id,
        name=resident.name if resident else "",
        roomNumber=resident.room_number if resident else None,
        careLevel=resident.care_level if resident else None,
        precautions=resident.precautions if resident else None,
    )

    # 8차: 활성 답변 조회
    answer_out: AnswerOut | None = None
    active_answer = _get_active_answer(db, inquiry_id)
    if active_answer:
        answer_out = _build_answer_out(active_answer, current_user)

    return StaffInquiryDetailResponse(
        inquiry=StaffInquiryDetailOut(
            id=inq.id,
            category=inq.category.value,
            title=inq.title,
            content=inq.content,
            status=inq.status.value,
            guardian=guardian_out,
            resident=resident_out,
            answer=answer_out,
            createdAt=inq.created_at,
            readBy=inq.read_by,
            readAt=inq.read_at,
        )
    )


# ─── PATCH /api/inquiries/{id}/read ──────────────────────────────────────────

@router.patch("/{inquiry_id}/read", response_model=InquiryReadResponse)
def mark_inquiry_read(
    inquiry_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> InquiryReadResponse:

    inq = db.get(Inquiry, inquiry_id)
    if not inq or inq.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "문의가 없습니다"})
    if inq.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    # idempotent: UNREAD인 경우에만 READ로 전이
    if inq.status == InquiryStatus.UNREAD:
        inq.status = InquiryStatus.READ
        inq.read_by = current_user.id
        inq.read_at = datetime.now(tz=timezone.utc)
        db.add(inq)
        db.commit()
        db.refresh(inq)

    return InquiryReadResponse(
        inquiry=InquiryReadOut(
            id=inq.id,
            status=inq.status.value,
            readAt=inq.read_at,
        )
    )


# ─── POST /api/inquiries/{id}/answer ─────────────────────────────────────────

@router.post("/{inquiry_id}/answer", status_code=201)
def create_answer(
    inquiry_id: int,
    body: AnswerCreateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AnswerCreateResponse:

    inq = db.get(Inquiry, inquiry_id)
    if not inq or inq.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "INQUIRY_NOT_FOUND", "message": "문의가 없습니다"})
    if inq.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    # 상태 검증: READ 상태에서만 답변 가능
    if inq.status == InquiryStatus.UNREAD:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_INQUIRY_STATUS", "message": "먼저 [확인 완료]로 표시한 뒤 답변해 주세요"},
        )
    if inq.status == InquiryStatus.ANSWERED:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_INQUIRY_STATUS", "message": "이미 답변이 등록된 문의입니다"},
        )

    # content 검증
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "답변 내용을 입력해 주세요"},
        )
    if len(content) > 500:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "답변은 500자 이하로 입력해 주세요"},
        )

    # 중복 활성 답변 체크 (UNIQUE 인덱스가 보호하지만 명시적 체크)
    existing = _get_active_answer(db, inquiry_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "ANSWER_ALREADY_EXISTS", "message": "이미 활성 답변이 존재합니다"},
        )

    # ★ 트랜잭션: 답변 INSERT + 상태 ANSWERED 동시 처리
    try:
        now = datetime.now(tz=timezone.utc)
        answer = InquiryAnswer(
            inquiry_id=inquiry_id,
            author_id=current_user.id,
            content=content,
            created_at=now,
            updated_at=now,
        )
        db.add(answer)
        inq.status = InquiryStatus.ANSWERED
        db.commit()
        db.refresh(answer)
        db.refresh(inq)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "답변 등록에 실패했습니다"},
        )

    return AnswerCreateResponse(
        answer=_build_answer_out(answer, current_user),
        inquiryStatus=inq.status.value,
    )


# ─── PATCH /api/inquiries/{id}/answer ────────────────────────────────────────

@router.patch("/{inquiry_id}/answer", status_code=200)
def update_answer(
    inquiry_id: int,
    body: AnswerUpdateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AnswerOut:

    inq = db.get(Inquiry, inquiry_id)
    if not inq or inq.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "INQUIRY_NOT_FOUND", "message": "문의가 없습니다"})
    if inq.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    answer = _get_active_answer(db, inquiry_id)
    if not answer:
        raise HTTPException(status_code=404, detail={"code": "ANSWER_NOT_FOUND", "message": "답변이 없습니다"})

    if not _can_edit_answer(answer, current_user):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "본인 답변 또는 관리자만 수정할 수 있습니다"},
        )

    content = (body.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "답변 내용을 입력해 주세요"},
        )
    if len(content) > 500:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "답변은 500자 이하로 입력해 주세요"},
        )

    answer.content = content
    answer.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(answer)

    return _build_answer_out(answer, current_user)


# ─── DELETE /api/inquiries/{id}/answer ───────────────────────────────────────

@router.delete("/{inquiry_id}/answer", status_code=204)
def delete_answer(
    inquiry_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> None:

    inq = db.get(Inquiry, inquiry_id)
    if not inq or inq.deleted_at:
        raise HTTPException(status_code=404, detail={"code": "INQUIRY_NOT_FOUND", "message": "문의가 없습니다"})
    if inq.facility_id != current_user.facility_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"})

    answer = _get_active_answer(db, inquiry_id)
    if not answer:
        raise HTTPException(status_code=404, detail={"code": "ANSWER_NOT_FOUND", "message": "답변이 없습니다"})

    if not _can_edit_answer(answer, current_user):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "본인 답변 또는 관리자만 삭제할 수 있습니다"},
        )

    # ★ 트랜잭션: soft delete + 상태 READ로 복귀 (UNREAD 아님, read_at 그대로)
    try:
        answer.deleted_at = datetime.now(tz=timezone.utc)
        inq.status = InquiryStatus.READ
        # read_at은 그대로 유지 (직원 확인 사실 보존)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "답변 삭제에 실패했습니다"},
        )

    return None

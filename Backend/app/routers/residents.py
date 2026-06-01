"""
GET /api/residents/assigned
로그인 직원의 담당 어르신 목록 + 오늘 알림장 작성 상태(NONE|SENT).

설계 원칙:
- precautions 절대 응답 미포함 (AI 프롬프트 주입 전용 민감정보)
- 미작성(NONE) 어르신 먼저 정렬
- 오늘 SENT 알림장이 여러 버전이면 MAX(version) 기준 최신본 참조
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, cast, func, select, Date as SADate
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_staff
from app.core.permissions import assert_assigned
from app.db.session import get_db
from app.models.models import AppUser, Assignment, Notice, NoticeStatus, Resident
from app.schemas.residents import (
    ResidentCard,
    ResidentDetailOut,
    ResidentDetailResponse,
    ResidentUpdateResponse,
    ResidentUpdateSchema,
    ResidentsResponse,
    Summary,
)

router = APIRouter(prefix="/api/residents", tags=["residents"])


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _calc_age(birth_date: date | None) -> int:
    if birth_date is None:
        return 0
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


# ─── 엔드포인트 ───────────────────────────────────────────────────────────────

@router.get("/assigned", response_model=ResidentsResponse)
def get_assigned_residents(
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ResidentsResponse:

    # ── 1. 담당 어르신 조회 ────────────────────────────────────────────────────
    stmt = (
        select(Assignment)
        .options(joinedload(Assignment.resident))
        .where(Assignment.user_id == current_user.id)
        .where(Assignment.deleted_at.is_(None))
        .join(Resident, Assignment.resident_id == Resident.id)
        .where(Resident.deleted_at.is_(None))
    )
    assignments = db.scalars(stmt).unique().all()

    if not assignments:
        return ResidentsResponse(
            summary=Summary(total=0, completed=0),
            residents=[],
        )

    resident_ids = [a.resident_id for a in assignments]

    # ── 2. 오늘 SENT 알림장 조회 (최신 버전 기준) ──────────────────────────────
    #
    # "오늘" 기준: sent_at::date = CURRENT_DATE (PostgreSQL 기준)
    # → Python date.today()와 DB 컨테이너 timezone 차이로 인한 불일치 방지.
    #
    # 버전 관리 정책:
    #   - 최초 전송: root_notice_id=NULL, version=1
    #   - 재전송:    root_notice_id=원본id, version=N+1
    #
    # "오늘의 현재 알림장" = 오늘 sent_at 범위 내 SENT 알림장 중 MAX(version)

    # 서브쿼리: 어르신별 오늘 최대 version
    max_ver_sq = (
        select(
            Notice.resident_id.label("res_id"),
            func.max(Notice.version).label("max_ver"),
        )
        .where(Notice.resident_id.in_(resident_ids))
        .where(Notice.status == NoticeStatus.SENT)
        .where(cast(Notice.sent_at, SADate) == func.current_date())
        .where(Notice.deleted_at.is_(None))
        .group_by(Notice.resident_id)
        .subquery()
    )

    # 해당 버전의 notice id·sent_at 가져오기
    notice_rows = db.execute(
        select(Notice.id, Notice.resident_id, Notice.sent_at)
        .join(
            max_ver_sq,
            and_(
                Notice.resident_id == max_ver_sq.c.res_id,
                Notice.version     == max_ver_sq.c.max_ver,
            ),
        )
        .where(Notice.status == NoticeStatus.SENT)
        .where(Notice.deleted_at.is_(None))
    ).all()

    # {resident_id: (notice_id, sent_at)}
    sent_map: dict[int, tuple[int, datetime]] = {
        row.resident_id: (row.id, row.sent_at) for row in notice_rows
    }

    # ── 3. 응답 조립 ───────────────────────────────────────────────────────────
    cards: list[ResidentCard] = []
    for a in assignments:
        r = a.resident
        notice_info = sent_map.get(r.id)

        cards.append(
            ResidentCard(
                id=r.id,
                name=r.name,
                age=_calc_age(r.birth_date),
                roomNumber=r.room_number,
                profileImageUrl=r.profile_image_url,
                careLevel=r.care_level,
                todayStatus="SENT" if notice_info else "NONE",
                todayNoticeId=notice_info[0] if notice_info else None,
                sentAt=notice_info[1].isoformat() if notice_info else None,
                # ★ precautions 절대 포함 금지
            )
        )

    # 미작성(NONE) 먼저, 동일 상태 내에서는 입력 순서 유지
    cards.sort(key=lambda c: 0 if c.todayStatus == "NONE" else 1)

    completed = sum(1 for c in cards if c.todayStatus == "SENT")

    return ResidentsResponse(
        summary=Summary(total=len(cards), completed=completed),
        residents=cards,
    )


# =============================================================================
# GET /api/residents/all  — 시설 전체 어르신 간략 목록 (앨범 참여자 선택용)
# require_staff: CAREGIVER / SOCIAL_WORKER / ADMIN 가능
# =============================================================================

@router.get("/all", response_model=list[dict])
def get_all_residents(
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> list[dict]:
    """앨범 등록/수정 시 참여 어르신 선택을 위한 시설 전체 어르신 목록."""
    rows = db.scalars(
        select(Resident)
        .where(Resident.facility_id == current_user.facility_id)
        .where(Resident.deleted_at.is_(None))
        .order_by(Resident.room_number.asc().nulls_last(), Resident.name.asc())
    ).all()
    return [
        {
            "id":         r.id,
            "name":       r.name,
            "roomNumber": r.room_number,
            "age":        _calc_age(r.birth_date),
            "profileImageUrl": r.profile_image_url,
            "careLevel":  r.care_level,
            "todayStatus":   "NONE",
            "todayNoticeId": None,
            "sentAt":        None,
        }
        for r in rows
    ]


# =============================================================================
# GET /api/residents/{resident_id}  — 단건 (precautions 툴팁용)
# =============================================================================

@router.get("/{resident_id}", response_model=ResidentDetailResponse)
def get_resident(
    resident_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ResidentDetailResponse:

    resident = db.get(Resident, resident_id)
    if resident is None or resident.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESIDENT_NOT_FOUND", "message": "어르신을 찾을 수 없습니다"},
        )

    # 담당 어르신만 조회 가능
    assert_assigned(db, current_user.id, resident_id)

    return ResidentDetailResponse(
        resident=ResidentDetailOut(
            id              = resident.id,
            name            = resident.name,
            age             = _calc_age(resident.birth_date),
            birthDate       = resident.birth_date.isoformat() if resident.birth_date else None,
            roomNumber      = resident.room_number,
            careLevel       = resident.care_level,
            precautions     = resident.precautions,    # ★ 이 엔드포인트의 핵심
            gender          = resident.gender.value if resident.gender else None,
            profileImageUrl = resident.profile_image_url,
        )
    )


# =============================================================================
# PATCH /api/residents/{resident_id}  — precautions 전용 수정 (4차 스프린트)
# =============================================================================

@router.patch("/{resident_id}", response_model=ResidentUpdateResponse)
def patch_resident(
    resident_id: int,
    body: ResidentUpdateSchema,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ResidentUpdateResponse:
    """
    precautions 단 한 필드만 수정 가능.
    ResidentUpdateSchema(extra='forbid') 가 다른 필드를 422로 자동 거부.
    담당 어르신 아니면 403.
    """

    resident = db.get(Resident, resident_id)
    if resident is None or resident.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESIDENT_NOT_FOUND", "message": "어르신을 찾을 수 없습니다"},
        )

    assert_assigned(db, current_user.id, resident_id)

    resident.precautions = body.precautions
    resident.updated_at  = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(resident)

    return ResidentUpdateResponse(
        id          = resident.id,
        name        = resident.name,
        roomNumber  = resident.room_number,
        careLevel   = resident.care_level,
        precautions = resident.precautions,
        updatedAt   = resident.updated_at.isoformat(),
    )

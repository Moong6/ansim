"""
7차 스프린트: 앨범 CRUD 라우터 (직원용)

GET    /api/albums              — 월별 목록     (require_staff)
GET    /api/albums/{id}         — 단건 상세     (require_staff)
POST   /api/albums              — 생성          (require_content_editor)
PATCH  /api/albums/{id}         — 수정          (require_content_editor + canEdit)
DELETE /api/albums/{id}         — 삭제          (require_content_editor + canEdit)
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.album import Album, album_resident_table
from app.models.models import AppUser, Resident, UserRole
from app.schemas.album import (
    AlbumCreateRequest,
    AlbumDetail,
    AlbumDetailResponse,
    AlbumListItem,
    AlbumListResponse,
    AlbumUpdateRequest,
    AuthorOut,
    ParticipantOut,
    PhotoItemOut,
)

router = APIRouter(prefix="/api/albums", tags=["albums"])


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _can_edit(album: Album, user: AppUser) -> bool:
    """모든 직원(CAREGIVER·SOCIAL_WORKER·ADMIN)이 수정·삭제 가능."""
    return user.role in (UserRole.CAREGIVER, UserRole.SOCIAL_WORKER, UserRole.ADMIN)


def _to_participant(r: Resident) -> ParticipantOut:
    return ParticipantOut(
        id=r.id,
        name=r.name,
        roomNumber=r.room_number,
    )


def _to_list_item(album: Album, user: AppUser) -> AlbumListItem:
    photos = album.photos or []
    thumbnail = photos[0]["url"] if photos else None
    return AlbumListItem(
        id=album.id,
        activityDate=album.activity_date,
        title=album.title,
        description=album.description,
        photoCount=len(photos),
        thumbnailUrl=thumbnail,
        participants=[_to_participant(r) for r in album.residents],
        author=AuthorOut(id=album.author.id, name=album.author.name),
        canEdit=_can_edit(album, user),
        createdAt=album.created_at,
    )


def _to_detail(album: Album, user: AppUser) -> AlbumDetail:
    return AlbumDetail(
        id=album.id,
        activityDate=album.activity_date,
        title=album.title,
        description=album.description,
        photos=[PhotoItemOut(url=p["url"]) for p in (album.photos or [])],
        participants=[_to_participant(r) for r in album.residents],
        author=AuthorOut(id=album.author.id, name=album.author.name),
        canEdit=_can_edit(album, user),
        createdAt=album.created_at,
        updatedAt=album.updated_at,
    )


def _fetch_residents(db: Session, facility_id: int, resident_ids: list[int]) -> list[Resident]:
    """거주자 ID 목록을 검증하고 Resident 객체 목록 반환. 잘못된 ID면 400."""
    if not resident_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_RESIDENT_IDS", "message": "참여 어르신을 1명 이상 선택해야 합니다"},
        )
    residents = db.scalars(
        select(Resident)
        .where(Resident.id.in_(resident_ids))
        .where(Resident.facility_id == facility_id)
        .where(Resident.deleted_at.is_(None))
    ).all()
    if len(residents) != len(set(resident_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_RESIDENT_IDS", "message": "존재하지 않는 어르신 ID가 포함되어 있습니다"},
        )
    return list(residents)


# ─── GET /api/albums?year=YYYY&month=MM ──────────────────────────────────────

@router.get("", response_model=AlbumListResponse)
def list_albums(
    year:  int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AlbumListResponse:
    """월별 앨범 목록 (activity_date 내림차순)."""

    month_start = date(year, month, 1)
    month_end   = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    rows = db.scalars(
        select(Album)
        .where(Album.facility_id == current_user.facility_id)
        .where(Album.deleted_at.is_(None))
        .where(Album.activity_date >= month_start)
        .where(Album.activity_date <  month_end)
        .order_by(Album.activity_date.desc(), Album.id.desc())
    ).all()

    items = [_to_list_item(a, current_user) for a in rows]
    return AlbumListResponse(year=year, month=month, total=len(items), items=items)


# ─── GET /api/albums/{album_id} ──────────────────────────────────────────────

@router.get("/{album_id}", response_model=AlbumDetailResponse)
def get_album(
    album_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AlbumDetailResponse:

    album = db.get(Album, album_id)
    if not album or album.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "앨범을 찾을 수 없습니다"},
        )
    if album.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    return AlbumDetailResponse(album=_to_detail(album, current_user))


# ─── POST /api/albums ─────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_album(
    body: AlbumCreateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    if len(body.photos) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOO_MANY_PHOTOS", "message": "사진은 최대 10장까지 등록할 수 있습니다"},
        )
    for p in body.photos:
        if not p.url.startswith("/static/albums/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_PHOTO_URL", "message": "유효하지 않은 사진 URL입니다"},
            )

    residents = _fetch_residents(db, current_user.facility_id, body.residentIds)

    now = datetime.now(tz=timezone.utc)
    album = Album(
        facility_id=current_user.facility_id,
        author_id=current_user.id,
        activity_date=body.activityDate,
        title=body.title,
        description=body.description,
        photos=[{"url": p.url, "uploadedAt": now.isoformat()} for p in body.photos],
        created_at=now,
        updated_at=now,
    )
    album.residents = residents
    db.add(album)
    db.commit()
    db.refresh(album)

    return {"id": album.id, "message": "앨범이 등록되었습니다"}


# ─── PATCH /api/albums/{album_id} ────────────────────────────────────────────

@router.patch("/{album_id}", status_code=200)
def update_album(
    album_id: int,
    body: AlbumUpdateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    album = db.get(Album, album_id)
    if not album or album.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "앨범을 찾을 수 없습니다"},
        )
    if album.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )
    if not _can_edit(album, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "작성자 또는 관리자만 수정할 수 있습니다"},
        )

    if body.activityDate is not None:
        album.activity_date = body.activityDate
    if body.title is not None:
        album.title = body.title
    if body.description is not None:
        album.description = body.description
    if body.residentIds is not None:
        residents = _fetch_residents(db, current_user.facility_id, body.residentIds)
        album.residents = residents
    if body.photos is not None:
        if len(body.photos) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "TOO_MANY_PHOTOS", "message": "사진은 최대 10장까지 등록할 수 있습니다"},
            )
        for p in body.photos:
            if not p.url.startswith("/static/albums/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_PHOTO_URL", "message": "유효하지 않은 사진 URL입니다"},
                )
        now = datetime.now(tz=timezone.utc)
        album.photos = [{"url": p.url, "uploadedAt": now.isoformat()} for p in body.photos]

    album.updated_at = datetime.now(tz=timezone.utc)
    db.commit()

    return {"id": album.id, "message": "앨범이 수정되었습니다"}


# ─── DELETE /api/albums/{album_id} ───────────────────────────────────────────

@router.delete("/{album_id}", status_code=200)
def delete_album(
    album_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:

    album = db.get(Album, album_id)
    if not album or album.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "앨범을 찾을 수 없습니다"},
        )
    if album.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )
    if not _can_edit(album, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "작성자 또는 관리자만 삭제할 수 있습니다"},
        )

    album.deleted_at = datetime.now(tz=timezone.utc)
    db.commit()

    return {"message": "앨범이 삭제되었습니다"}

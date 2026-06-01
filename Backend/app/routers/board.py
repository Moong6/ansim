"""
공지사항 게시판 (4차 스프린트)

  GET    /api/board          목록 (페이지네이션)
  GET    /api/board/{id}     단건
  POST   /api/board          작성
  PATCH  /api/board/{id}     수정
  DELETE /api/board/{id}     소프트 삭제

권한 규칙:
  - 작성: 로그인 직원 누구나
  - 수정/삭제: post.author_id == current_user.id  OR  role == ADMIN
  - 조회: 같은 facility_id 소속이면 OK
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.board import NoticeBoard
from app.models.models import AppUser, UserRole
from app.schemas.board import (
    AuthorOut,
    BoardCreateRequest,
    BoardDetailOut,
    BoardDetailResponse,
    BoardItemOut,
    BoardListResponse,
    BoardUpdateRequest,
)

router = APIRouter(prefix="/api/board", tags=["board"])


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _can_edit(post: NoticeBoard, user: AppUser) -> bool:
    return post.author_id == user.id or user.role == UserRole.ADMIN


def _require_edit_permission(post: NoticeBoard, user: AppUser) -> None:
    if not _can_edit(post, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "수정·삭제 권한이 없습니다"},
        )


def _get_active_post(post_id: int, facility_id: int, db: Session) -> NoticeBoard:
    """조회 + 시설 격리 + 소프트 삭제 제외. 실패 시 403/404."""
    post = db.get(NoticeBoard, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "POST_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
        )
    if post.facility_id != facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )
    return post


def _to_item(post: NoticeBoard, user: AppUser) -> BoardItemOut:
    return BoardItemOut(
        id=post.id,
        title=post.title,
        preview=post.content[:100],
        author=AuthorOut(
            id=post.author.id,
            name=post.author.name,
            role=post.author.role.value,
        ),
        createdAt=post.created_at.isoformat(),
        canEdit=_can_edit(post, user),
    )


# ─── 엔드포인트 ───────────────────────────────────────────────────────────────

@router.get("", response_model=BoardListResponse)
def list_board(
    limit:  int = Query(20, ge=1, le=100),
    offset: int = Query(0,  ge=0),
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> BoardListResponse:
    base = (
        select(NoticeBoard)
        .options(joinedload(NoticeBoard.author))
        .where(NoticeBoard.facility_id == current_user.facility_id)
        .where(NoticeBoard.deleted_at.is_(None))
    )
    total = db.scalar(
        select(func.count(NoticeBoard.id))
        .where(NoticeBoard.facility_id == current_user.facility_id)
        .where(NoticeBoard.deleted_at.is_(None))
    ) or 0

    posts = db.scalars(
        base.order_by(NoticeBoard.created_at.desc()).limit(limit).offset(offset)
    ).unique().all()

    return BoardListResponse(
        total=total,
        items=[_to_item(p, current_user) for p in posts],
    )


@router.get("/{post_id}", response_model=BoardDetailResponse)
def get_board(
    post_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> BoardDetailResponse:
    post = db.scalars(
        select(NoticeBoard)
        .options(joinedload(NoticeBoard.author))
        .where(NoticeBoard.id == post_id)
    ).first()

    if post is None or post.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "POST_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
        )
    if post.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )

    return BoardDetailResponse(
        post=BoardDetailOut(
            id=post.id,
            title=post.title,
            content=post.content,
            author=AuthorOut(
                id=post.author.id,
                name=post.author.name,
                role=post.author.role.value,
            ),
            createdAt=post.created_at.isoformat(),
            updatedAt=post.updated_at.isoformat(),
            canEdit=_can_edit(post, current_user),
        )
    )


@router.post("", response_model=BoardDetailResponse, status_code=status.HTTP_201_CREATED)
def create_board(
    body: BoardCreateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> BoardDetailResponse:
    post = NoticeBoard(
        facility_id=current_user.facility_id,
        author_id=current_user.id,
        title=body.title,
        content=body.content,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    # author 관계 로드
    db.refresh(post, ["author"])

    return BoardDetailResponse(
        post=BoardDetailOut(
            id=post.id,
            title=post.title,
            content=post.content,
            author=AuthorOut(
                id=post.author.id,
                name=post.author.name,
                role=post.author.role.value,
            ),
            createdAt=post.created_at.isoformat(),
            updatedAt=post.updated_at.isoformat(),
            canEdit=True,  # 방금 본인이 작성
        )
    )


@router.patch("/{post_id}", response_model=BoardDetailResponse)
def update_board(
    post_id: int,
    body: BoardUpdateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> BoardDetailResponse:
    post = db.scalars(
        select(NoticeBoard)
        .options(joinedload(NoticeBoard.author))
        .where(NoticeBoard.id == post_id)
    ).first()

    if post is None or post.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "POST_NOT_FOUND", "message": "공지를 찾을 수 없습니다"},
        )
    if post.facility_id != current_user.facility_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "접근 권한이 없습니다"},
        )
    _require_edit_permission(post, current_user)

    if body.title is not None:
        post.title = body.title
    if body.content is not None:
        post.content = body.content
    post.updated_at = datetime.now(tz=timezone.utc)
    db.commit()
    db.refresh(post)

    return BoardDetailResponse(
        post=BoardDetailOut(
            id=post.id,
            title=post.title,
            content=post.content,
            author=AuthorOut(
                id=post.author.id,
                name=post.author.name,
                role=post.author.role.value,
            ),
            createdAt=post.created_at.isoformat(),
            updatedAt=post.updated_at.isoformat(),
            canEdit=_can_edit(post, current_user),
        )
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(
    post_id: int,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> None:
    post = _get_active_post(post_id, current_user.facility_id, db)
    _require_edit_permission(post, current_user)

    post.deleted_at = datetime.now(tz=timezone.utc)
    db.commit()

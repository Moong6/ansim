"""
권한 검증 헬퍼

여러 라우터에서 공통으로 쓰는 "현재 사용자가 해당 어르신 담당인지" 검사.
notices.py, residents.py 등에서 import 해서 사용.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Assignment


def assert_assigned(db: Session, user_id: int, resident_id: int) -> None:
    """담당 아니면 403 FORBIDDEN."""
    assigned = db.scalars(
        select(Assignment)
        .where(Assignment.user_id == user_id)
        .where(Assignment.resident_id == resident_id)
        .where(Assignment.deleted_at.is_(None))
    ).first()
    if assigned is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "담당하지 않는 어르신입니다"},
        )

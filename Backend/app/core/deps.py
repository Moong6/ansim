"""
FastAPI 공통 의존성

get_current_user  — JWT 검증 후 AppUser 반환.
require_staff     — CAREGIVER/SOCIAL_WORKER/ADMIN만 허용 (보호자 토큰 차단).
require_guardian  — GUARDIAN만 허용.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.models import AppUser, UserRole

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> AppUser:
    try:
        user_id = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "유효하지 않은 토큰입니다"},
        )

    user: AppUser | None = db.get(AppUser, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "계정을 찾을 수 없습니다"},
        )

    return user


def require_staff(user: AppUser = Depends(get_current_user)) -> AppUser:
    """CAREGIVER / SOCIAL_WORKER / ADMIN 만 통과. GUARDIAN 토큰이면 403."""
    if user.role == UserRole.GUARDIAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "직원 전용 기능입니다"},
        )
    return user


def require_guardian(user: AppUser = Depends(get_current_user)) -> AppUser:
    """GUARDIAN 만 통과. 그 외 역할이면 403."""
    if user.role != UserRole.GUARDIAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "보호자 전용 기능입니다"},
        )
    return user


def require_content_editor(user: AppUser = Depends(get_current_user)) -> AppUser:
    """SOCIAL_WORKER / ADMIN 만 통과. CAREGIVER·GUARDIAN 토큰이면 403."""
    if user.role not in (UserRole.SOCIAL_WORKER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "콘텐츠 편집 권한이 없습니다"},
        )
    return user

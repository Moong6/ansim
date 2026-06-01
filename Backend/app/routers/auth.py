"""
POST /api/auth/login
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.models import AppUser
from app.schemas.auth import LoginRequest, LoginResponse, UserOut, FacilityOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 공통 에러 응답 형태
def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 일치하지 않습니다"},
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"description": "INVALID_CREDENTIALS"},
        400: {"description": "VALIDATION_ERROR"},
    },
)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    # 1) 이메일로 활성 계정 조회 (soft delete 제외 + facility eagerly load)
    stmt = (
        select(AppUser)
        .options(joinedload(AppUser.facility))
        .where(AppUser.email == body.email)
        .where(AppUser.deleted_at.is_(None))
    )
    user: AppUser | None = db.scalars(stmt).first()

    # 2) 계정 없음 or 비밀번호 불일치 → 동일 에러 (타이밍 어택 방지)
    if user is None or not verify_password(body.password, user.password_hash):
        raise _credentials_error()

    # 3) JWT 발급
    token = create_access_token(user.id)

    # 4) 응답 조립
    return LoginResponse(
        token=token,
        user=UserOut(
            id=user.id,
            name=user.name,
            role=user.role.value,
            preferredLang=user.preferred_lang,
            facility=FacilityOut.model_validate(user.facility),
        ),
    )

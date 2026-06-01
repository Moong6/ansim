"""
PATCH /api/users/me/language
로그인한 직원 본인의 preferred_lang 만 변경.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.models import AppUser
from app.schemas.users import (
    ALLOWED_LANGS,
    LanguageUpdateRequest,
    LanguageUpdateResponse,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.patch("/me/language", response_model=LanguageUpdateResponse)
def update_my_language(
    body: LanguageUpdateRequest,
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> LanguageUpdateResponse:

    if body.preferredLang not in ALLOWED_LANGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_LANGUAGE",
                "message": f"지원하지 않는 언어 코드입니다. 허용: {sorted(ALLOWED_LANGS)}",
            },
        )

    current_user.preferred_lang = body.preferredLang
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return LanguageUpdateResponse(preferredLang=current_user.preferred_lang)

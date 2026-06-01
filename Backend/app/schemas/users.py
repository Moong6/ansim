"""
PATCH /api/users/me/language 요청 / 응답
"""

from pydantic import BaseModel

# 허용 언어 코드 (라우터에서 검증 후 400 INVALID_LANGUAGE 반환)
ALLOWED_LANGS = {"ko", "vi", "zh", "en"}


class LanguageUpdateRequest(BaseModel):
    preferredLang: str


class LanguageUpdateResponse(BaseModel):
    preferredLang: str

"""
인증 관련 Pydantic v2 스키마
POST /api/auth/login 요청 / 응답
"""

from pydantic import BaseModel, EmailStr


# ─── 요청 ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


# ─── 응답 중첩 모델 ───────────────────────────────────────────────────────────

class FacilityOut(BaseModel):
    id:      int
    name:    str
    address: str | None = None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id:            int
    name:          str
    role:          str
    preferredLang: str          # 2차: 직원 기본 메모 입력 언어 (ko/vi/zh/en)
    facility:      FacilityOut

    model_config = {"from_attributes": True}


# ─── 응답 ─────────────────────────────────────────────────────────────────────

class LoginResponse(BaseModel):
    token: str
    user:  UserOut


# ─── 공통 에러 봉투 ───────────────────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code:    str
    message: str

class ErrorResponse(BaseModel):
    error: ErrorDetail

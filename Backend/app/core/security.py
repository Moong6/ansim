"""
보안 유틸 — JWT 발급/검증 + bcrypt 비밀번호 검증

passlib 1.7.x + bcrypt 4.x 호환 문제로 bcrypt 라이브러리를 직접 사용.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# JWT 설정
ALGORITHM   = "HS256"
EXPIRE_DAYS = 7


# ─── 비밀번호 ─────────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    """DB의 bcrypt 해시와 입력 비밀번호를 대조한다."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    """bcrypt 해시를 생성한다. 직접 DB 시드 업데이트 시 사용."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    """JWT 액세스 토큰 발급."""
    expire = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    """
    JWT 검증 후 user_id(int) 반환.
    유효하지 않으면 JWTError 발생 → 라우터에서 401 처리.
    """
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise JWTError("sub claim missing")
    return int(user_id_str)

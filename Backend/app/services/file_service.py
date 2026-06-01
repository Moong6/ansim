"""
6차 스프린트: 파일 업로드 서비스
7차 스프린트: subfolder 파라미터 추가 (meals / albums)

save_upload(file: UploadFile, subfolder: str = "meals") → url: str

검증 순서:
  1. 파일 크기 ≤ UPLOAD_MAX_SIZE_MB
  2. 확장자 ∈ UPLOAD_ALLOWED_EXT
  3. MIME 타입 검증 (Pillow Image.verify) — 확장자 위조 방지
  4. 파일명 uuid4.ext 생성 (원본명 무시, 보안)
  5. 저장: {UPLOAD_DIR}/{subfolder}/{yyyy}/{mm}/{uuid}.{ext}
  6. 반환 URL: /static/{subfolder}/{yyyy}/{mm}/{uuid}.{ext}
     (STATIC_BASE_URL은 클라이언트가 직접 fetch 시 필요하지 않음 — 상대 경로 반환)
"""

import io
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# 사진 검증에 Pillow 사용
try:
    from PIL import Image, UnidentifiedImageError
    _PILLOW_AVAILABLE = True
except ImportError:
    _PILLOW_AVAILABLE = False


def _get_allowed_exts() -> set[str]:
    return {e.strip().lower() for e in settings.UPLOAD_ALLOWED_EXT.split(",")}


async def save_upload(file: UploadFile, subfolder: str = "meals") -> dict:
    """
    UploadFile을 검증·저장하고 { url, filename, sizeBytes } 반환.
    subfolder: 'meals' | 'albums' (기본값: 'meals')
    에러 시 HTTPException raise.
    """
    max_bytes = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024
    allowed_exts = _get_allowed_exts()

    # ── 1. 파일 전체 읽기 ──────────────────────────────────────────────────────
    content = await file.read()
    size_bytes = len(content)

    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"파일 크기가 {settings.UPLOAD_MAX_SIZE_MB}MB를 초과합니다",
            },
        )

    # ── 2. 확장자 검증 ─────────────────────────────────────────────────────────
    original_name = file.filename or ""
    suffix = Path(original_name).suffix.lstrip(".").lower()
    if suffix not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_FILE_TYPE",
                "message": f"허용 확장자: {', '.join(sorted(allowed_exts))}",
            },
        )

    # ── 3. MIME 타입 검증 (Pillow) ─────────────────────────────────────────────
    if _PILLOW_AVAILABLE:
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()  # 손상/위조 이미지 감지
        except (UnidentifiedImageError, Exception):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_IMAGE",
                    "message": "유효한 이미지 파일이 아닙니다",
                },
            )
    # Pillow 없을 때는 확장자 검증으로 대체 (개발 환경 fallback)

    # ── 4. 저장 경로 생성 ──────────────────────────────────────────────────────
    now = datetime.now()
    yyyy = now.strftime("%Y")
    mm   = now.strftime("%m")
    new_filename = f"{uuid.uuid4()}.{suffix}"

    upload_base = Path(settings.UPLOAD_DIR)
    target_dir = upload_base / subfolder / yyyy / mm
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / new_filename
    target_path.write_bytes(content)

    # ── 5. URL 반환 (상대 경로 — FastAPI 정적 마운트가 /static 으로 서빙) ────
    url = f"/static/{subfolder}/{yyyy}/{mm}/{new_filename}"

    return {
        "url": url,
        "filename": new_filename,
        "sizeBytes": size_bytes,
    }

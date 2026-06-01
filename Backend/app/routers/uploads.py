"""
6차 스프린트: 파일 업로드 라우터
7차 스프린트: 앨범 사진 업로드 엔드포인트 추가

POST /api/uploads/meal-photo  — 식단 사진 업로드 (require_staff: CAREGIVER 포함)
POST /api/uploads/album-photo — 앨범 사진 업로드 (require_staff: CAREGIVER 포함)
"""

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse

from app.core.deps import require_staff
from app.models.models import AppUser
from app.services.file_service import save_upload

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/meal-photo", status_code=201)
async def upload_meal_photo(
    file: UploadFile = File(...),
    _: AppUser = Depends(require_staff),
) -> JSONResponse:
    """
    식단 사진 업로드 (CAREGIVER/SOCIAL_WORKER/ADMIN 가능).
    multipart/form-data, field name: file
    응답 201: { url, filename, sizeBytes }
    """
    result = await save_upload(file, subfolder="meals")
    return JSONResponse(status_code=201, content=result)


@router.post("/album-photo", status_code=201)
async def upload_album_photo(
    file: UploadFile = File(...),
    _: AppUser = Depends(require_staff),
) -> JSONResponse:
    """
    앨범 사진 업로드 (CAREGIVER/SOCIAL_WORKER/ADMIN 가능).
    multipart/form-data, field name: file
    응답 201: { url, filename, sizeBytes }
    """
    result = await save_upload(file, subfolder="albums")
    return JSONResponse(status_code=201, content=result)

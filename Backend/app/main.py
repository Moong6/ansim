from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings  # noqa: F401  — validates .env on startup
from app.routers import albums, auth, board, home, inquiries, meals, notices, parent, programs, reports, residents, schedule, uploads, users

app = FastAPI(title="케어알림장 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://moong6.github.io",
        "https://filter-reverence-radish.ngrok-free.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 정적 파일 서빙 (업로드 이미지) ─────────────────────────────────────────────
# /static/** → {UPLOAD_DIR}/** 매핑
# 샘플 사진(static/meals/sample/)도 함께 서빙하기 위해 upload_dir가 없어도 폴더 생성
_upload_dir = Path(settings.UPLOAD_DIR)
_upload_dir.mkdir(parents=True, exist_ok=True)

# static/meals/sample/ 폴더도 UPLOAD_DIR에 심볼릭 링크 대신 직접 복사 패턴 대신,
# 정적 마운트를 두 개로 나눠 처리: /static → uploads/, /static/meals/sample → static/meals/sample/
# 단순 구현: UPLOAD_DIR = ./uploads, static 폴더도 같이 마운트
# → uploads/meals/sample 폴더에 샘플을 두거나, static 폴더를 별도 마운트
# 핸드오프 명세: URL이 /static/meals/sample/ 이므로, UPLOAD_DIR=./uploads 에 meals/sample 폴더를 두면 됨
_sample_dir = _upload_dir / "meals" / "sample"
_sample_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(_upload_dir)), name="static")

# ─── 전역 예외 핸들러 ─────────────────────────────────────────────────────────
# FastAPI 기본: {"detail": ...}  →  핸드오프 명세: {"error": {"code","message"}}
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        error = detail
    else:
        error = {"code": "INTERNAL_ERROR", "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": error})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic 스키마 검증 오류를 {"error": {"code", "message"}} 형식으로 통일."""
    first = exc.errors()[0] if exc.errors() else {}
    msg = first.get("msg", "요청 형식이 올바르지 않습니다")
    # Pydantic이 "Value error, " 접두어를 붙이는 경우 제거
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "INVALID_REQUEST", "message": msg}},
    )


# ─── 라우터 등록 ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(home.router)
app.include_router(board.router)
app.include_router(programs.router)
app.include_router(residents.router)
app.include_router(notices.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(parent.router)
app.include_router(inquiries.router)
app.include_router(meals.router)
app.include_router(schedule.router)
app.include_router(uploads.router)
app.include_router(albums.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

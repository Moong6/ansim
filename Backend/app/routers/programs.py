"""
GET /api/programs/today
로그인 직원의 시설(facility_id) + 오늘 날짜 기준 공통 프로그램 목록 반환.

날짜 비교는 Python date.today() 대신 PostgreSQL CURRENT_DATE 를 사용한다.
→ DB 컨테이너와 애플리케이션 서버의 timezone 차이로 인한 불일치 방지.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.db.session import get_db
from app.models.models import AppUser, Program
from app.schemas.programs import ProgramOut, ProgramsResponse

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("/today", response_model=ProgramsResponse)
def get_today_programs(
    current_user: AppUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> ProgramsResponse:

    # PostgreSQL의 CURRENT_DATE를 기준으로 삼아 timezone 차이 원천 차단
    pg_today: str = db.scalar(text("SELECT CURRENT_DATE::text"))   # "YYYY-MM-DD"

    stmt = (
        select(Program)
        .where(Program.facility_id == current_user.facility_id)
        .where(Program.program_date == func.current_date())
        .where(Program.deleted_at.is_(None))
        .order_by(Program.start_time.asc().nulls_last())
    )
    programs = db.scalars(stmt).all()

    return ProgramsResponse(
        date=pg_today,
        programs=[
            ProgramOut(
                id=p.id,
                startTime=p.start_time.strftime("%H:%M") if p.start_time else None,
                title=p.title,
                description=p.description,
            )
            for p in programs
        ],
    )

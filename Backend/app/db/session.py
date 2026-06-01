from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # 끊긴 커넥션 자동 재연결
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI Depends에서 사용하는 DB 세션 제너레이터."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

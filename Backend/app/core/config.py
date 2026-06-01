from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-8b"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash"
    JWT_SECRET: str
    CLASSIFICATION_THRESHOLD: float = 0.6

    # 파일 업로드 (6차)
    UPLOAD_DIR: str = "./uploads"
    UPLOAD_MAX_SIZE_MB: int = 5
    UPLOAD_ALLOWED_EXT: str = "jpg,jpeg,png,webp"
    STATIC_BASE_URL: str = "http://localhost:8000/static"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Render는 postgres:// 또는 postgresql:// 형식 제공 → psycopg v3 드라이버로 변환"""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://") and "+psycopg" not in v:
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v


settings = Settings()

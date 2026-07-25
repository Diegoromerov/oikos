"""Configuración centralizada usando pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, RedisDsn, field_validator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional


class Settings(BaseSettings):
    """Configuración de la aplicación cargada desde variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ─────────────────────────────────────────────────────────────
    app_name: str = "GlowApp Beauty Intelligence Engine"
    app_version: str = "2.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    allowed_hosts: list[str] = ["*"]

    # ── Database ────────────────────────────────────────────────────────
    database_url_env: Optional[str] = Field(default=None, alias="database_url")
    postgres_user: str = "admin"
    postgres_password: str = "admin123"
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5435
    postgres_db: str = "beauty_db"

    @property
    def database_url(self) -> str:
        url = self.database_url_env or (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def database_url_sync(self) -> str:
        url = self.database_url_env or (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        if url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # ── Redis ───────────────────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 0

    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # ── Security ────────────────────────────────────────────────────────
    secret_key: str = "CHANGE_ME_IN_PRODUCTION_use_openssl_rand_hex_32"
    access_token_expire_minutes: int = 60 * 24  # 24 horas
    algorithm: str = "HS256"

    # ── AWS S3 ──────────────────────────────────────────────────────────
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "glowapp-dev-images"
    s3_cdn_url: str = ""

    # ── IA Providers ────────────────────────────────────────────────────
    gemini_api_key: str = ""
    claude_api_key: str = ""
    ai_primary_provider: Literal["gemini", "claude"] = "gemini"
    ai_max_tokens_per_request: int = 4096
    ai_timeout_seconds: int = 30

    # ── TikTok API ──────────────────────────────────────────────────────
    tiktok_api_key: str = ""
    tiktok_api_secret: str = ""

    # ── Monitoring ──────────────────────────────────────────────────────
    sentry_dsn: str = ""
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # ── Colombian Compliance ────────────────────────────────────────────
    ley_1581_consent_required: bool = True
    biometric_data_retention_days: int = 365


@lru_cache()
def get_settings() -> Settings:
    """Retorna la configuración cacheada (singleton)."""
    return Settings()


settings = get_settings()

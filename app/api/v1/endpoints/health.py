"""Endpoints de health check para monitoreo."""

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis

router = APIRouter()


@router.get("/")
async def health_root() -> dict[str, str]:
    """Health check básico (solo verifica que la API responde)."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get("/detailed")
async def health_detailed(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Health check detallado: verifica DB, Redis y dependencias externas."""
    checks: dict[str, dict] = {}

    # ── Database ────────────────────────────────────────────────────────
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "error", "detail": str(e)}

    # ── Redis ───────────────────────────────────────────────────────────
    try:
        redis = get_redis()
        await redis.ping()
        checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)}

    # ── IA Provider ─────────────────────────────────────────────────────
    ai_configured = bool(
        settings.gemini_api_key if settings.ai_primary_provider == "gemini"
        else settings.claude_api_key
    )
    checks["ai_provider"] = {
        "status": "ok" if ai_configured else "not_configured",
        "provider": settings.ai_primary_provider,
    }

    # ── S3 ──────────────────────────────────────────────────────────────
    s3_configured = bool(settings.aws_access_key_id and settings.aws_secret_access_key)
    checks["s3"] = {
        "status": "ok" if s3_configured else "not_configured",
        "bucket": settings.s3_bucket_name,
    }

    overall_status = (
        "ok"
        if checks["database"]["status"] == "ok" and checks["redis"]["status"] == "ok"
        else "degraded"
    )

    return {
        "status": overall_status,
        "version": settings.app_version,
        "checks": checks,
    }


@router.get("/ready")
async def readiness_check() -> dict[str, str]:
    """Readiness probe para Kubernetes."""
    return {"status": "ready"}


@router.get("/live")
async def liveness_probe() -> dict[str, str]:
    """Liveness probe para Kubernetes."""
    return {"status": "alive"}

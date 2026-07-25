"""Aplicación principal FastAPI."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.logging import get_logger, setup_logging
from app.core.redis import close_redis, init_redis
from app.api.router import api_router

import sentry_sdk


logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifecycle de la aplicación: startup y shutdown."""
    # ── Startup ─────────────────────────────────────────────────────────
    logger.info("starting_glowapp", version=settings.app_version, env=settings.environment)

    setup_logging()
    await init_db()
    logger.info("database_initialized")

    await init_redis()
    logger.info("redis_initialized")

    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            release=settings.app_version,
            traces_sample_rate=0.1,
        )
        logger.info("sentry_initialized")

    yield

    # ── Shutdown ────────────────────────────────────────────────────────
    logger.info("shutting_down_glowapp")
    await close_redis()
    await close_db()
    logger.info("shutdown_complete")


def create_app() -> FastAPI:
    """Factory de la aplicación FastAPI."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="API del Beauty Intelligence Engine de GlowApp",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # ── Middleware ──────────────────────────────────────────────────────
    if settings.environment != "development":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts,
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routes ──────────────────────────────────────────────────────────
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()

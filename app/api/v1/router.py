"""Router principal de la API."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    health,
    users,
    beauty_profiles,
    biometric_consents,
    beauty_scan_sessions,
    tiktok_trends,
    beauty_scan,
    color_lab,
    marketplace,
    hair_analyzer,
)

api_router = APIRouter()

# Health check
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"],
)

# Usuarios
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["users"],
)

# Beauty Profiles
api_router.include_router(
    beauty_profiles.router,
    prefix="/beauty-profiles",
    tags=["beauty"],
)

# Consentimientos biométricos
api_router.include_router(
    biometric_consents.router,
    prefix="/biometric-consents",
    tags=["consents"],
)

# Sesiones de escaneo
api_router.include_router(
    beauty_scan_sessions.router,
    prefix="/beauty-scan-sessions",
    tags=["beauty"],
)

# Tendencias TikTok
api_router.include_router(
    tiktok_trends.router,
    prefix="/tiktok-trends",
    tags=["trends"],
)

# Escaneo Beauty IA
api_router.include_router(
    beauty_scan.router,
    prefix="/beauty-scan",
    tags=["beauty"],
)

# Color Lab
api_router.include_router(
    color_lab.router,
    prefix="/color-lab",
    tags=["color-lab"],
)

# Marketplace
api_router.include_router(
    marketplace.router,
    prefix="/marketplace",
    tags=["marketplace"],
)

# Hair Analyzer
api_router.include_router(
    hair_analyzer.router,
    prefix="/hair-analyzer",
    tags=["hair-analyzer"],
)

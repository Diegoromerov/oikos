"""Endpoints de tendencias de TikTok."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.tiktok_hashtag_trend import TikTokHashtagTrendResponse
from app.services.tiktok_trend_service import TikTokTrendService

router = APIRouter()


@router.get("/", response_model=list[TikTokHashtagTrendResponse])
async def get_trending_hashtags(
    category: str | None = Query(None, description="Filtrar por categoría"),
    min_growth: float = Query(0.0, description="Crecimiento mínimo (%)"),
    limit: int = Query(10, ge=1, le=100, description="Límite de resultados"),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene hashtags trending."""
    service = TikTokTrendService(db)
    trends = await service.get_trending_hashtags(category, min_growth, limit)
    return trends

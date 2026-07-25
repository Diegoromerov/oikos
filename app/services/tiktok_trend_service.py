"""Servicio CRUD para TikTokHashtagTrend."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tiktok_hashtag_trend import TikTokHashtagTrend
from app.schemas.tiktok_hashtag_trend import TikTokHashtagTrendCreate


class TikTokTrendService:
    """Servicio de tendencias de TikTok."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_trend(
        self,
        trend_data: TikTokHashtagTrendCreate
    ) -> TikTokHashtagTrend:
        """Crea nueva tendencia."""
        trend = TikTokHashtagTrend(**trend_data.model_dump())
        self.db.add(trend)
        await self.db.flush()
        await self.db.refresh(trend)
        return trend
    
    async def get_trend_by_hashtag(self, hashtag: str) -> TikTokHashtagTrend | None:
        """Obtiene tendencia por hashtag."""
        result = await self.db.execute(
            select(TikTokHashtagTrend).where(
                TikTokHashtagTrend.hashtag == hashtag
            )
        )
        return result.scalar_one_or_none()
    
    async def get_trending_hashtags(
        self,
        category: str | None = None,
        min_growth: float = 0.0,
        limit: int = 10
    ) -> list[TikTokHashtagTrend]:
        """Obtiene hashtags trending filtrados."""
        query = select(TikTokHashtagTrend).where(
            TikTokHashtagTrend.growth_percentage >= min_growth
        )
        
        if category:
            query = query.where(TikTokHashtagTrend.category == category)
        
        query = query.order_by(
            TikTokHashtagTrend.growth_percentage.desc()
        ).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def update_trend(
        self,
        trend_id: UUID,
        **kwargs
    ) -> TikTokHashtagTrend | None:
        """Actualiza tendencia."""
        result = await self.db.execute(
            select(TikTokHashtagTrend).where(TikTokHashtagTrend.id == trend_id)
        )
        trend = result.scalar_one_or_none()
        
        if not trend:
            return None
        
        for field, value in kwargs.items():
            if hasattr(trend, field):
                setattr(trend, field, value)
        
        await self.db.flush()
        await self.db.refresh(trend)
        
        return trend

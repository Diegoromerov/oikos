"""Schemas de Pydantic para TikTokHashtagTrend."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TikTokHashtagTrendCreate(BaseModel):
    """Schema para crear tendencia."""
    
    hashtag: str = Field(..., max_length=100)
    category: str = Field(..., max_length=50)
    category_label: str = Field(..., max_length=100)
    volume: int = Field(..., gt=0)
    growth_percentage: float
    is_new: bool = False
    country: str = Field(default="CO", max_length=10)
    period_days: int = Field(default=30, gt=0)


class TikTokHashtagTrendResponse(BaseModel):
    """Schema de respuesta de tendencia."""
    
    id: UUID
    hashtag: str
    category: str
    category_label: str
    volume: int
    growth_percentage: float
    is_new: bool
    last_updated: datetime
    country: str
    period_days: int
    
    model_config = {"from_attributes": True}

"""Modelo de tendencias de hashtags de TikTok."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class TikTokHashtagTrend(Base, UUIDMixin):
    """Tendencia de hashtag de TikTok (actualizado periódicamente)."""
    
    __tablename__ = "tiktok_hashtag_trends"
    
    # Hashtag
    hashtag: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    
    # Categoría
    category: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        # "rutina_cuidado" | "producto_resena" | "glow_estetica" |
        # "ingredientes_activos" | "anti_edad" | "diagnostico_educacion" |
        # "preocupaciones_piel" | "local_colombia"
    )
    category_label: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    
    # Métricas
    volume: Mapped[int] = mapped_column(
        Integer,
        nullable=False,  # Número de vistas
    )
    growth_percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False,  # Porcentaje de crecimiento (puede ser negativo)
    )
    
    # Metadata
    is_new: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    
    # País y período
    country: Mapped[str] = mapped_column(
        String(10),
        default="CO",
        nullable=False,
    )
    period_days: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False,
    )

"""Modelo de snapshot de evolución (historial mensual)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class EvolutionSnapshot(Base, UUIDMixin):
    """Snapshot mensual de evolución del beauty profile."""
    
    __tablename__ = "evolution_snapshots"
    
    # Relación con beauty profile
    beauty_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("beauty_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # Fecha del snapshot
    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    
    # Métricas del snapshot
    beauty_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,  # 0 a 100
    )
    skin_concerns_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    hair_damage_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,  # "none" | "mild" | "moderate" | "severe"
    )
    
    # Mejoras detectadas
    improvements: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura: ["hydration +15%", "pores -10%", "beauty_score +5"]
    )
    
    # Snapshot completo (para auditoría)
    full_snapshot: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Copia completa del beauty_profile en ese momento
    )
    
    # Relación
    beauty_profile = relationship("BeautyProfile", back_populates="evolution_snapshots")

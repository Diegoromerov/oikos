"""Modelo de Beauty Profile unificado."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class BeautyProfile(Base, UUIDMixin, TimestampMixin):
    """Perfil beauty 360° unificado del usuario."""
    
    __tablename__ = "beauty_profiles"
    
    # Relación con usuario
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    
    # ── Análisis de piel ──────────────────────────────────────────────
    skin_subtone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,  # 'cold', 'warm', 'neutral', 'unknown'
    )
    skin_subtone_confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,  # 0.0 a 1.0
    )
    skin_concerns: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura: [
        #   {
        #     "type": "acne" | "rosacea" | "hyperpigmentation" | "pores" | "dehydration" | "wrinkles",
        #     "severity": "mild" | "moderate" | "severe",
        #     "detected_at": "2026-07-07T15:30:00Z",
        #     "confidence": 0.85
        #   }
        # ]
    )
    
    # ── Análisis capilar ──────────────────────────────────────────────
    hair_diagnosis: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # {
        #   "porosity": "low" | "medium" | "high",
        #   "damage_level": "none" | "mild" | "moderate" | "severe",
        #   "hair_type": "straight" | "wavy" | "curly" | "coily",
        #   "density": "thin" | "medium" | "thick",
        #   "detected_at": "2026-07-07T15:30:00Z"
        # }
    )
    
    # ── Morfología de manos ───────────────────────────────────────────
    hand_morphology: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # {
        #   "hand_shape": "square" | "oval" | "tapered" | "spatulate",
        #   "finger_length": "short" | "medium" | "long",
        #   "recommended_nail_shape": "round" | "oval" | "almond" | "coffin" | "stiletto",
        #   "detected_at": "2026-07-07T15:30:00Z"
        # }
    )
    
    # ── Visajismo de cejas ────────────────────────────────────────────
    brow_visajismo: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # {
        #   "face_shape": "oval" | "round" | "square" | "heart" | "oblong",
        #   "ideal_brow_start": 0.25,
        #   "ideal_brow_arch": 0.67,
        #   "ideal_brow_end": 0.90,
        #   "symmetry_score": 0.88,
        #   "detected_at": "2026-07-07T15:30:00Z"
        # }
    )
    
    # ── Afinidad con tendencias ───────────────────────────────────────
    trend_affinity: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # [
        #   {
        #     "category": "ingredientes_activos" | "local_colombia" | "rutina_cuidado" | "glow_estetica",
        #     "trending_hashtags": ["bakuchiol", "niacinamida"],
        #     "match_score": 0.95,
        #     "updated_at": "2026-07-07T15:30:00Z"
        #   }
        # ]
    )
    
    # ── Historial de evolución ────────────────────────────────────────
    evolution_history: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
        # Estructura:
        # [
        #   {
        #     "scan_date": "2026-07-07T15:30:00Z",
        #     "beauty_score": 78,
        #     "skin_concerns_count": 3,
        #     "hair_damage_level": "mild",
        #     "improvements": ["hydration +15%", "pores -10%"]
        #   }
        # ]
    )
    
    # ── Beauty Score (calculado) ──────────────────────────────────────
    beauty_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,  # 0 a 100
    )
    
    # ── Relaciones ────────────────────────────────────────────────────
    user = relationship("User", back_populates="beauty_profile")
    evolution_snapshots = relationship(
        "EvolutionSnapshot",
        back_populates="beauty_profile",
        cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        Index("ix_beauty_profiles_skin_subtone", "skin_subtone"),
    )

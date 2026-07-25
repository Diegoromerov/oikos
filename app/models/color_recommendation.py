"""Modelos de Recomendación de Color e Historial Try-On."""

from datetime import datetime
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import ForeignKey, String, Numeric, Boolean, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class ColorRecommendation(Base, UUIDMixin):
    """Recomendación de color para un usuario según un mood."""
    
    __tablename__ = "color_recommendations"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    color_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    brand_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    color_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    reference: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    color_value: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    mood: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    
    # Harmony Scores
    harmony_score: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )
    skin_match: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    eye_match: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    trend_match: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    technical_viability: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    lifestyle_match: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    
    is_forbidden: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
    )
    
    user = relationship("User", back_populates="color_recommendations")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'color_id', 'mood', name='uq_user_color_mood'),
    )


class ColorTryOnHistory(Base, UUIDMixin):
    """Historial de simulaciones Try-On AR realizadas por el usuario."""
    
    __tablename__ = "color_try_on_history"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    color_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    light_condition: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )
    screenshot_url: Mapped[str] = mapped_column(
        String,
        nullable=True,
    )
    user_rating: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
    )
    user_feedback: Mapped[str] = mapped_column(
        String,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
    )

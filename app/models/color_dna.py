"""Modelo de ColorDNA."""

from typing import Any, List
from uuid import UUID

from sqlalchemy import ForeignKey, String, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ColorDNA(Base, TimestampMixin):
    """Huella cromática única del usuario (Color DNA)."""
    
    __tablename__ = "color_dnas"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    harmonic_palette: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    skin_undertone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    hair_porosity: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    forbidden_colors: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    forbidden_reason: Mapped[str] = mapped_column(
        String,
        nullable=True,
    )
    signature_colors: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    adventure_index: Mapped[float] = mapped_column(
        Numeric(3, 2),
        nullable=False,
    )
    
    user = relationship("User", back_populates="color_dna")

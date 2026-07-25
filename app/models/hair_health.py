"""Modelos SQLAlchemy para el módulo Hair Intelligence Engine."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, String, Numeric, Integer, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class HairHealthReport(Base, UUIDMixin):
    """Diagnóstico clínico-capilar histórico de escaneo de cabello."""
    
    __tablename__ = "hair_health_reports"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("beauty_scan_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # Métricas de diagnóstico (Raw AI output)
    curl_pattern: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    porosity_level: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    density_level: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    gray_hair_percentage: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    current_color_level: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    
    # Puntuaciones calculadas (0 a 100)
    damage_index: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    moisture_level: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    elasticity_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    overall_health_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    
    # Metadatos de IA
    ai_confidence_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    analysis_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relaciones
    user = relationship("User", back_populates="hair_reports")
    treatment_plan = relationship("HairTreatmentPlan", back_populates="report", uselist=False, cascade="all, delete-orphan")


class HairTreatmentPlan(Base, UUIDMixin):
    """Plan de tratamiento capilar recomendado generado por IA."""
    
    __tablename__ = "hair_treatment_plans"
    
    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("hair_health_reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    recommended_shampoos: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    recommended_conditioners: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    recommended_masks: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    protein_treatment_needed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    protein_frequency_days: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    heat_protection_required: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    trim_recommendation_cm: Mapped[Optional[float]] = mapped_column(
        Numeric(3, 1),
        nullable=True,
    )
    trim_frequency_weeks: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    ingredients_to_avoid: Mapped[List[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )
    
    report = relationship("HairHealthReport", back_populates="treatment_plan")

"""Modelo de usuario."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    """Usuario de la plataforma GlowApp."""
    
    __tablename__ = "users"
    
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    city: Mapped[str] = mapped_column(
        String(100),
        default="Bogotá",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    
    # Relaciones
    beauty_profile = relationship(
        "BeautyProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    biometric_consents = relationship(
        "BiometricConsent",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    beauty_scan_sessions = relationship(
        "BeautyScanSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    color_dna = relationship(
        "ColorDNA",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    color_recommendations = relationship(
        "ColorRecommendation",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    affiliate = relationship(
        "Affiliate",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    hair_reports = relationship(
        "HairHealthReport",
        back_populates="user",
        cascade="all, delete-orphan",
    )

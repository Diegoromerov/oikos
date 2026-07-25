"""Modelo de consentimiento biométrico versionado (Ley 1581)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class BiometricConsent(Base, UUIDMixin):
    """Consentimiento biométrico versionado por usuario."""
    
    __tablename__ = "biometric_consents"
    
    # Relación con usuario
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # Versionado del consentimiento
    version: Mapped[str] = mapped_column(
        String(10),
        nullable=False,  # "1.0", "1.1", etc.
    )
    consent_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,  # "standard" | "dermatological"
    )
    
    # Metadata de aceptación
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ip_address: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    consent_text_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,  # SHA256 hash del texto aceptado
    )
    
    # Revocación (si aplica)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Metadata legal
    jurisdiction: Mapped[str] = mapped_column(
        String(50),
        default="Colombia",
        nullable=False,
    )
    legal_framework: Mapped[str] = mapped_column(
        String(100),
        default="Ley 1581 de 2012",
        nullable=False,
    )
    
    # Relación
    user = relationship("User", back_populates="biometric_consents")
    
    # Índices únicos
    __table_args__ = (
        Index(
            "uq_active_consent_type_version",
            "user_id",
            "consent_type",
            "version",
            unique=True,
            postgresql_where="revoked_at IS NULL",
        ),
    )

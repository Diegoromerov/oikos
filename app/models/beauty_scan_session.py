"""Modelo de sesión de escaneo beauty."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class BeautyScanSession(Base, UUIDMixin):
    """Sesión de escaneo beauty (captura de 4 imágenes)."""
    
    __tablename__ = "beauty_scan_sessions"
    
    # Relación con usuario
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # Metadata de la sesión
    session_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,  # Número secuencial de sesión del usuario
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # URLs de imágenes en S3
    images: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # {
        #   "face_frontal": "s3://bucket/path/face_frontal.jpg",
        #   "face_lateral": "s3://bucket/path/face_lateral.jpg",
        #   "hair": "s3://bucket/path/hair.jpg",
        #   "hand": "s3://bucket/path/hand.jpg"
        # }
    )
    
    # Estado del procesamiento
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",  # "pending" | "processing" | "completed" | "failed"
        nullable=False,
    )
    
    # Resultado del análisis (referencia al beauty_profile actualizado)
    beauty_profile_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("beauty_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # Metadata de procesamiento
    processing_metadata: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        # Estructura:
        # {
        #   "ai_provider": "gemini",
        #   "model": "gemini-2.0-flash",
        #   "tokens_used": 6500,
        #   "cost_usd": 0.00165,
        #   "processing_time_seconds": 3.2,
        #   "retry_count": 0
        # }
    )
    
    # Error (si falló)
    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    
    # Relación
    user = relationship("User", back_populates="beauty_scan_sessions")
    beauty_profile = relationship("BeautyProfile")

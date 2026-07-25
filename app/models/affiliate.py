"""Modelo de Afiliados."""

from datetime import datetime
from uuid import UUID
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class Affiliate(Base, UUIDMixin):
    """Modelo para representar a los afiliados del sistema."""
    
    __tablename__ = "affiliates"
    
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )
    
    commissions = relationship("AffiliateCommission", back_populates="affiliate", cascade="all, delete-orphan")
    user = relationship("User", back_populates="affiliate")


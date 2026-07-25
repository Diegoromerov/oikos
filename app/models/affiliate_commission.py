"""Modelo de Comisiones de Afiliados."""

from datetime import datetime
from uuid import UUID
from sqlalchemy import ForeignKey, String, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class AffiliateCommission(Base, UUIDMixin):
    """Modelo para registrar las comisiones acumuladas por referidos y compras."""
    
    __tablename__ = "affiliate_commissions"
    
    affiliate_id: Mapped[UUID] = mapped_column(
        ForeignKey("affiliates.id", ondelete="CASCADE"),
        nullable=False,
    )
    referral_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    purchase_amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    commission_rate: Mapped[float] = mapped_column(
        Numeric(5, 2),
        default=0.15,
        nullable=False,
    )
    commission_amount: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String,
        default="pending",
        nullable=False,  # pending / paid
    )
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )
    
    affiliate = relationship("Affiliate", back_populates="commissions")

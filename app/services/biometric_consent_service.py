"""Servicio CRUD para BiometricConsent."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.biometric_consent import BiometricConsent
from app.schemas.biometric_consent import BiometricConsentCreate


class BiometricConsentService:
    """Servicio de consentimientos biométricos."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_consent(
        self,
        user_id: UUID,
        consent_data: BiometricConsentCreate
    ) -> BiometricConsent:
        """Crea nuevo consentimiento."""
        consent = BiometricConsent(
            user_id=user_id,
            version=consent_data.version,
            consent_type=consent_data.consent_type,
            accepted_at=datetime.utcnow(),
            ip_address=consent_data.ip_address,
            user_agent=consent_data.user_agent,
            consent_text_hash=consent_data.consent_text_hash,
        )
        
        self.db.add(consent)
        await self.db.flush()
        await self.db.refresh(consent)
        
        return consent
    
    async def get_active_consent(
        self,
        user_id: UUID,
        consent_type: str
    ) -> BiometricConsent | None:
        """Obtiene consentimiento activo (no revocado) más reciente."""
        result = await self.db.execute(
            select(BiometricConsent)
            .where(
                BiometricConsent.user_id == user_id,
                BiometricConsent.consent_type == consent_type,
                BiometricConsent.revoked_at.is_(None),
            )
            .order_by(BiometricConsent.accepted_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    
    async def revoke_consent(self, consent_id: UUID) -> bool:
        """Revoca consentimiento."""
        result = await self.db.execute(
            select(BiometricConsent).where(BiometricConsent.id == consent_id)
        )
        consent = result.scalar_one_or_none()
        
        if not consent:
            return False
        
        consent.revoked_at = datetime.utcnow()
        await self.db.flush()
        
        return True
    
    async def get_all_consents(self, user_id: UUID) -> list[BiometricConsent]:
        """Obtiene todos los consentimientos de un usuario."""
        result = await self.db.execute(
            select(BiometricConsent)
            .where(BiometricConsent.user_id == user_id)
            .order_by(BiometricConsent.accepted_at.desc())
        )
        return list(result.scalars().all())

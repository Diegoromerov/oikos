"""Endpoints de consentimientos biométricos."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.biometric_consent import (
    BiometricConsentCreate,
    BiometricConsentResponse,
)
from app.services.biometric_consent_service import BiometricConsentService

router = APIRouter()


@router.post("/", response_model=BiometricConsentResponse, status_code=status.HTTP_201_CREATED)
async def create_consent(
    user_id: UUID,
    consent_data: BiometricConsentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Registra consentimiento biométrico."""
    service = BiometricConsentService(db)
    consent = await service.create_consent(user_id, consent_data)
    return consent


@router.get("/{user_id}/active/{consent_type}", response_model=BiometricConsentResponse)
async def get_active_consent(
    user_id: UUID,
    consent_type: str,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene consentimiento activo de un tipo."""
    service = BiometricConsentService(db)
    consent = await service.get_active_consent(user_id, consent_type)
    
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consentimiento activo no encontrado",
        )
    
    return consent


@router.post("/{consent_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_consent(
    consent_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Revoca consentimiento."""
    service = BiometricConsentService(db)
    success = await service.revoke_consent(consent_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consentimiento no encontrado",
        )
    
    return {"message": "Consentimiento revocado exitosamente"}


@router.get("/{user_id}", response_model=list[BiometricConsentResponse])
async def get_all_consents(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene todos los consentimientos de un usuario."""
    service = BiometricConsentService(db)
    consents = await service.get_all_consents(user_id)
    return consents

"""Schemas de Pydantic para BiometricConsent."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BiometricConsentCreate(BaseModel):
    """Schema para crear consentimiento."""
    
    version: str = Field(..., max_length=10)
    consent_type: Literal["standard", "dermatological"]
    ip_address: str | None = None
    user_agent: str | None = None
    consent_text_hash: str = Field(..., max_length=64)


class BiometricConsentResponse(BaseModel):
    """Schema de respuesta de consentimiento."""
    
    id: UUID
    user_id: UUID
    version: str
    consent_type: str
    accepted_at: datetime
    ip_address: str | None
    user_agent: str | None
    consent_text_hash: str
    revoked_at: datetime | None
    jurisdiction: str
    legal_framework: str
    
    model_config = {"from_attributes": True}

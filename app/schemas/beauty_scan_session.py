"""Schemas de Pydantic para BeautyScanSession."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class BeautyScanSessionCreate(BaseModel):
    """Schema para crear sesión de escaneo."""
    
    session_number: int = Field(..., gt=0)
    started_at: datetime


class BeautyScanSessionUpdate(BaseModel):
    """Schema para actualizar sesión."""
    
    images: dict | None = None
    status: Literal["pending", "processing", "completed", "failed"] | None = None
    beauty_profile_id: UUID | None = None
    processing_metadata: dict | None = None
    error_message: str | None = None
    completed_at: datetime | None = None


class BeautyScanSessionResponse(BaseModel):
    """Schema de respuesta de sesión."""
    
    id: UUID
    user_id: UUID
    session_number: int
    started_at: datetime
    completed_at: datetime | None
    images: dict | None
    status: str
    beauty_profile_id: UUID | None
    processing_metadata: dict | None
    error_message: str | None
    
    model_config = {"from_attributes": True}

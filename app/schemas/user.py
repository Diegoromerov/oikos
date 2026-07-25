"""Schemas de Pydantic para User."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Schema base de usuario."""
    
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str | None = Field(None, max_length=20)
    city: str = Field(default="Bogotá", max_length=100)


class UserCreate(UserBase):
    """Schema para crear usuario."""
    
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Schema para actualizar usuario."""
    
    full_name: str | None = Field(None, min_length=2, max_length=255)
    phone: str | None = Field(None, max_length=20)
    city: str | None = Field(None, max_length=100)


class UserResponse(UserBase):
    """Schema de respuesta de usuario."""
    
    id: UUID
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

"""Endpoints de BeautyProfile."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.beauty_profile import BeautyProfileResponse
from app.services.beauty_profile_service import BeautyProfileService

router = APIRouter()


@router.get("/{user_id}", response_model=BeautyProfileResponse)
async def get_beauty_profile(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene BeautyProfile de un usuario."""
    service = BeautyProfileService(db)
    profile = await service.get_by_user_id(user_id)
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BeautyProfile no encontrado",
        )
    
    return profile

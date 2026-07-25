"""Servicio CRUD para BeautyProfile."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beauty_profile import BeautyProfile


class BeautyProfileService:
    """Servicio de BeautyProfile."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_user_id(self, user_id: UUID) -> BeautyProfile | None:
        """Obtiene perfil por user_id."""
        result = await self.db.execute(
            select(BeautyProfile).where(BeautyProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def create_profile(self, user_id: UUID, **kwargs) -> BeautyProfile:
        """Crea nuevo perfil."""
        profile = BeautyProfile(user_id=user_id, **kwargs)
        self.db.add(profile)
        await self.db.flush()
        await self.db.refresh(profile)
        return profile
    
    async def update_profile(
        self,
        user_id: UUID,
        **kwargs
    ) -> BeautyProfile | None:
        """Actualiza perfil."""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return None
        
        for field, value in kwargs.items():
            if hasattr(profile, field):
                setattr(profile, field, value)
        
        await self.db.flush()
        await self.db.refresh(profile)
        
        return profile
    
    async def delete_profile(self, user_id: UUID) -> bool:
        """Elimina perfil."""
        profile = await self.get_by_user_id(user_id)
        if not profile:
            return False
        
        await self.db.delete(profile)
        await self.db.flush()
        
        return True

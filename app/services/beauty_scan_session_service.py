"""Servicio CRUD para BeautyScanSession."""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beauty_scan_session import BeautyScanSession
from app.schemas.beauty_scan_session import (
    BeautyScanSessionCreate,
    BeautyScanSessionUpdate,
)


class BeautyScanSessionService:
    """Servicio de sesiones de escaneo."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_session(
        self,
        user_id: UUID,
        session_data: BeautyScanSessionCreate
    ) -> BeautyScanSession:
        """Crea nueva sesión."""
        session = BeautyScanSession(
            user_id=user_id,
            session_number=session_data.session_number,
            started_at=session_data.started_at,
        )
        
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        
        return session
    
    async def get_session(self, session_id: UUID) -> BeautyScanSession | None:
        """Obtiene sesión por ID."""
        result = await self.db.execute(
            select(BeautyScanSession).where(BeautyScanSession.id == session_id)
        )
        return result.scalar_one_or_none()
    
    async def update_session(
        self,
        session_id: UUID,
        update_data: BeautyScanSessionUpdate
    ) -> BeautyScanSession | None:
        """Actualiza sesión."""
        session = await self.get_session(session_id)
        if not session:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(session, field, value)
        
        await self.db.flush()
        await self.db.refresh(session)
        
        return session
    
    async def get_user_sessions(
        self,
        user_id: UUID,
        limit: int = 10,
        offset: int = 0
    ) -> list[BeautyScanSession]:
        """Obtiene sesiones de un usuario."""
        result = await self.db.execute(
            select(BeautyScanSession)
            .where(BeautyScanSession.user_id == user_id)
            .order_by(BeautyScanSession.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    async def get_next_session_number(self, user_id: UUID) -> int:
        """Obtiene siguiente número de sesión para un usuario."""
        result = await self.db.execute(
            select(func.max(BeautyScanSession.session_number))
            .where(BeautyScanSession.user_id == user_id)
        )
        max_number = result.scalar()
        return (max_number or 0) + 1

"""Endpoints de sesiones de escaneo."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.beauty_scan_session import (
    BeautyScanSessionCreate,
    BeautyScanSessionResponse,
    BeautyScanSessionUpdate,
)
from app.services.beauty_scan_session_service import BeautyScanSessionService

router = APIRouter()


@router.post("/", response_model=BeautyScanSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Crea nueva sesión de escaneo."""
    service = BeautyScanSessionService(db)
    
    # Calcular siguiente número de sesión
    next_number = await service.get_next_session_number(user_id)
    
    session_data = BeautyScanSessionCreate(
        session_number=next_number,
        started_at=datetime.utcnow(),
    )
    
    session = await service.create_session(user_id, session_data)
    return session


@router.get("/{session_id}", response_model=BeautyScanSessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene sesión por ID."""
    service = BeautyScanSessionService(db)
    session = await service.get_session(session_id)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    
    return session


@router.patch("/{session_id}", response_model=BeautyScanSessionResponse)
async def update_session(
    session_id: UUID,
    update_data: BeautyScanSessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza sesión."""
    service = BeautyScanSessionService(db)
    session = await service.update_session(session_id, update_data)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    
    return session


@router.get("/user/{user_id}", response_model=list[BeautyScanSessionResponse])
async def get_user_sessions(
    user_id: UUID,
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene sesiones de un usuario."""
    service = BeautyScanSessionService(db)
    sessions = await service.get_user_sessions(user_id, limit, offset)
    return sessions

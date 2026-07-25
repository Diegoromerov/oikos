"""Endpoint de escaneo beauty."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.biometric_consent import BiometricConsent
from app.services.beauty_orchestrator import BeautyOrchestrator

router = APIRouter()
@router.post("/process")
async def process_beauty_scan(
    user_id: UUID,
    scan_session_id: UUID,
    face_frontal: UploadFile | None = File(None),
    face_lateral: UploadFile | None = File(None),
    hair: UploadFile | None = File(None),
    hand: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Procesa un escaneo beauty multimodal permitiendo imágenes opcionales (Ley 1581).
    """
    # 1. Verificar consentimiento biométrico activo
    consent_stmt = select(BiometricConsent).where(
        BiometricConsent.user_id == user_id,
        BiometricConsent.revoked_at.is_(None)
    )
    consent_result = await db.execute(consent_stmt)
    consent = consent_result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(
            status_code=403,
            detail="Consentimiento biométrico requerido (Ley 1581)."
        )
        
    # 2. Leer bytes de las imágenes que sí fueron provistas
    images_bytes = {}
    try:
        if face_frontal is not None and face_frontal.filename:
            images_bytes["face_frontal"] = await face_frontal.read()
        if face_lateral is not None and face_lateral.filename:
            images_bytes["face_lateral"] = await face_lateral.read()
        if hair is not None and hair.filename:
            images_bytes["hair"] = await hair.read()
        if hand is not None and hand.filename:
            images_bytes["hand"] = await hand.read()
            
        if not images_bytes:
            raise ValueError("Debe cargar al menos una imagen autorizada para procesar el diagnóstico.")
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error al leer archivos de imagen: {str(e)}"
        )
    try:
        orchestrator = BeautyOrchestrator(db)
        analysis, metadata = await orchestrator.process_scan(
            user_id=user_id,
            images=images_bytes,
            scan_session_id=scan_session_id,
        )
        
        # Guardar cambios
        await db.commit()
        
        return {
            "analysis": analysis.model_dump(),
            "metadata": metadata.model_dump(),
        }
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno en el escaneo: {str(e)}")

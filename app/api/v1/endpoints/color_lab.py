"""Endpoints de API para el módulo Color Lab."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.color_dna import ColorDNA
from app.schemas.color_lab import (
    ColorDNAOut,
    ColorRecommendationOut,
    ColorLabResponse,
    MoodType,
    TryOnHistoryCreate,
    HarmonyScore
)
from app.services.color_lab_service import ColorLabService
from app.services.beauty_profile_service import BeautyProfileService
from app.services.tiktok_trend_service import TikTokTrendService

router = APIRouter()

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_color_lab(
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Genera la huella cromática Color DNA y las recomendaciones."""
    profile_service = BeautyProfileService(db)
    beauty_profile = await profile_service.get_by_user_id(user_id)
    
    if not beauty_profile:
        # Si no tiene perfil, creamos uno mock básico para permitir la ejecución del Lab
        beauty_profile = await profile_service.create_profile(
            user_id=user_id,
            skin_subtone="warm",
            hair_diagnosis={
                "porosity": "medium",
                "damage_level": "medium",
                "current_level": 5
            }
        )
    
    # Adaptar el objeto de ORM a un dict para HarmonyCalculator
    profile_dict = {
        "skin_subtone": beauty_profile.skin_subtone,
        "eye_color": "brown",
        "hair_diagnosis": beauty_profile.hair_diagnosis
    }
    
    service = ColorLabService(db)
    color_dna = await service.generate_color_dna(user_id, profile_dict)
    
    return {
        "message": "Color Lab generado exitosamente",
        "color_dna": {
            "harmonic_palette": color_dna.harmonic_palette,
            "skin_undertone": color_dna.skin_undertone,
            "hair_porosity": color_dna.hair_porosity,
            "forbidden_colors": color_dna.forbidden_colors,
            "forbidden_reason": color_dna.forbidden_reason,
            "signature_colors": color_dna.signature_colors,
            "adventure_index": float(color_dna.adventure_index),
            "user_id": str(color_dna.user_id),
            "created_at": color_dna.created_at,
            "updated_at": color_dna.updated_at
        }
    }


@router.get("/dna", response_model=ColorDNAOut)
async def get_color_dna(
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el Color DNA del usuario."""
    result = await db.execute(select(ColorDNA).where(ColorDNA.user_id == user_id))
    color_dna = result.scalar_one_or_none()
    
    if not color_dna:
        # Autogenerar si no existe
        await generate_color_lab(user_id=user_id, db=db)
        result = await db.execute(select(ColorDNA).where(ColorDNA.user_id == user_id))
        color_dna = result.scalar_one_or_none()
        
    return color_dna


@router.get("/recommendations", response_model=List[ColorRecommendationOut])
async def get_recommendations(
    mood: Optional[MoodType] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene recomendaciones de color filtradas por mood."""
    service = ColorLabService(db)
    recommendations = await service.get_recommendations(user_id, mood=mood, limit=limit)
    return recommendations


@router.get("", response_model=ColorLabResponse)
async def get_complete_color_lab(
    mood: Optional[MoodType] = Query(None),
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el Color DNA completo, recomendaciones y tendencias."""
    # 1. Obtener ADN
    result = await db.execute(select(ColorDNA).where(ColorDNA.user_id == user_id))
    color_dna = result.scalar_one_or_none()
    
    if not color_dna:
        # Generar si no existe
        await generate_color_lab(user_id=user_id, db=db)
        result = await db.execute(select(ColorDNA).where(ColorDNA.user_id == user_id))
        color_dna = result.scalar_one_or_none()
    
    # 2. Recomendaciones
    service = ColorLabService(db)
    recommendations = await service.get_recommendations(user_id, mood=mood, limit=20)
    
    # 3. Tendencias
    trends_service = TikTokTrendService(db)
    trends_list = await trends_service.get_trending_hashtags(limit=10)
    trending_colors = [{"hashtag": t.hashtag, "growth_percentage": t.growth_percentage} for t in trends_list]
    
    # 4. Harmony Scores mapping
    harmony_scores = {}
    for rec in recommendations:
        harmony_scores[rec.color_id] = HarmonyScore(
            total=float(rec.harmony_score),
            skin_match=float(rec.skin_match) if rec.skin_match else None,
            eye_match=float(rec.eye_match) if rec.eye_match else None,
            trend_match=float(rec.trend_match) if rec.trend_match else None,
            technical_viability=float(rec.technical_viability) if rec.technical_viability else None,
            lifestyle_match=float(rec.lifestyle_match) if rec.lifestyle_match else None
        )
        
    return ColorLabResponse(
        color_dna=color_dna,
        recommendations=recommendations,
        trending_colors=trending_colors,
        harmony_scores=harmony_scores
    )


@router.post("/try-on/history")
async def save_try_on_history(
    try_on_data: TryOnHistoryCreate,
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Guarda una simulación Try-On AR."""
    service = ColorLabService(db)
    try_on = await service.save_try_on_history(
        user_id=user_id,
        color_id=try_on_data.color_id,
        light_condition=try_on_data.light_condition.value if try_on_data.light_condition else None,
        screenshot_url=try_on_data.screenshot_url
    )
    return {"message": "Try-on history saved", "id": str(try_on.id)}

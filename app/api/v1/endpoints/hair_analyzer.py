"""Endpoints de API para el módulo Hair Intelligence Engine."""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.models.hair_health import HairHealthReport, HairTreatmentPlan
from app.models.beauty_profile import BeautyProfile
from app.schemas.hair_analyzer import HairAnalysisResponse
from app.services.hair_analyzer.ai_diagnostician import HairAIDiagnostician
from app.services.hair_analyzer.health_scorer import HairHealthScorer
from app.services.hair_analyzer.treatment_planner import TreatmentPlanner

router = APIRouter()

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


@router.post("/scan", response_model=HairAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_hair(
    file: UploadFile = File(...),
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Diagnóstico clínico-capilar e IA sobre una foto del cabello del usuario."""
    # 1. Leer imagen
    image_bytes = await file.read()
    
    # 2. Diagnóstico IA
    diagnostician = HairAIDiagnostician()
    diagnostic_result = await diagnostician.analyze_hair_image(image_bytes)
    
    # 3. Calcular Health Score
    scorer = HairHealthScorer()
    health_score = scorer.calculate(diagnostic_result)
    
    # 4. Generar Plan de Tratamiento
    planner = TreatmentPlanner(db)
    treatment_plan = planner.generate_plan(diagnostic_result, health_score)
    
    # 5. Guardar en Base de Datos
    report = HairHealthReport(
        user_id=user_id,
        curl_pattern=diagnostic_result["curl_pattern"],
        porosity_level=diagnostic_result["porosity_level"],
        density_level=diagnostic_result["density_level"],
        gray_hair_percentage=diagnostic_result["gray_hair_percentage"],
        current_color_level=diagnostic_result["current_color_level"],
        damage_index=health_score.damage_index,
        moisture_level=health_score.moisture_level,
        elasticity_score=health_score.elasticity_score,
        overall_health_score=health_score.overall,
        ai_confidence_score=diagnostic_result["ai_confidence_score"]
    )
    
    db.add(report)
    await db.flush()
    
    plan_record = HairTreatmentPlan(
        report_id=report.id,
        recommended_shampoos=treatment_plan.recommended_shampoos,
        recommended_conditioners=treatment_plan.recommended_conditioners,
        recommended_masks=treatment_plan.recommended_masks,
        protein_treatment_needed=treatment_plan.protein_treatment_needed,
        protein_frequency_days=treatment_plan.protein_frequency_days,
        heat_protection_required=treatment_plan.heat_protection_required,
        trim_recommendation_cm=treatment_plan.trim_recommendation_cm,
        trim_frequency_weeks=treatment_plan.trim_frequency_weeks,
        ingredients_to_avoid=treatment_plan.ingredients_to_avoid
    )
    db.add(plan_record)
    
    # 6. Actualizar BeautyProfile
    damage_index = float(health_score.damage_index)
    damage_level = "high" if damage_index > 70.0 else "medium" if damage_index > 40.0 else "low"
    
    # Verificar si existe el perfil, si no, crear uno
    bp_result = await db.execute(select(BeautyProfile).where(BeautyProfile.user_id == user_id))
    profile = bp_result.scalar_one_or_none()
    
    hair_diagnosis_data = {
        "porosity": diagnostic_result["porosity_level"],
        "damage_level": damage_level,
        "hair_type": diagnostic_result["curl_pattern"],
        "density": diagnostic_result["density_level"],
        "current_level": diagnostic_result["current_color_level"]
    }
    
    if profile:
        await db.execute(
            update(BeautyProfile)
            .where(BeautyProfile.user_id == user_id)
            .values(hair_diagnosis=hair_diagnosis_data)
        )
    else:
        new_profile = BeautyProfile(
            user_id=user_id,
            hair_diagnosis=hair_diagnosis_data
        )
        db.add(new_profile)
        
    await db.flush()
    
    return HairAnalysisResponse(
        report_id=report.id,
        health_score=health_score,
        diagnostic=diagnostic_result,
        treatment_plan=treatment_plan,
        ai_confidence=float(diagnostic_result["ai_confidence_score"])
    )


@router.get("/history")
async def get_hair_history(
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el historial de análisis de cabello ordenado por fecha descendente."""
    stmt = select(HairHealthReport).where(
        HairHealthReport.user_id == user_id
    ).order_by(HairHealthReport.created_at.desc())
    
    result = await db.execute(stmt)
    return list(result.scalars().all())

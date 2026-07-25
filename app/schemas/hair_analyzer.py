"""Esquemas Pydantic para el módulo Hair Intelligence Engine."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class HairDiagnosticResult(BaseModel):
    curl_pattern: str
    porosity_level: str
    density_level: str
    gray_hair_percentage: float = Field(..., ge=0.0, le=100.0)
    current_color_level: int = Field(..., ge=1, le=10)
    damage_index: float = Field(..., ge=0.0, le=100.0)
    moisture_level: float = Field(..., ge=0.0, le=100.0)
    elasticity_score: float = Field(..., ge=0.0, le=100.0)


class HairHealthScore(BaseModel):
    overall: float
    damage_index: float
    moisture_level: float
    elasticity_score: float
    scalp_health: Optional[float] = None


class TreatmentPlanOut(BaseModel):
    recommended_shampoos: List[str]
    recommended_conditioners: List[str]
    recommended_masks: List[str]
    protein_treatment_needed: bool
    protein_frequency_days: Optional[int] = None
    heat_protection_required: bool
    trim_recommendation_cm: Optional[float] = None
    trim_frequency_weeks: Optional[int] = None
    ingredients_to_avoid: List[str]


class HairAnalysisResponse(BaseModel):
    report_id: UUID
    health_score: HairHealthScore
    diagnostic: HairDiagnosticResult
    treatment_plan: TreatmentPlanOut
    ai_confidence: float

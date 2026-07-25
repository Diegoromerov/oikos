"""Schemas de Pydantic para BeautyProfile."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SkinConcern(BaseModel):
    """Preocupación de piel detectada."""
    
    type: Literal["acne", "rosacea", "hyperpigmentation", "pores", "dehydration", "wrinkles"]
    severity: Literal["mild", "moderate", "severe"]
    detected_at: datetime
    confidence: float = Field(..., ge=0.0, le=1.0)


class HairDiagnosis(BaseModel):
    """Diagnóstico capilar."""
    
    porosity: Literal["low", "medium", "high"]
    damage_level: Literal["none", "mild", "moderate", "severe"]
    hair_type: Literal["straight", "wavy", "curly", "coily"]
    density: Literal["thin", "medium", "thick"]
    detected_at: datetime


class HandMorphology(BaseModel):
    """Morfología de manos."""
    
    hand_shape: Literal["square", "oval", "tapered", "spatulate"]
    finger_length: Literal["short", "medium", "long"]
    recommended_nail_shape: Literal["round", "oval", "almond", "coffin", "stiletto"]
    detected_at: datetime


class BrowVisajismo(BaseModel):
    """Visajismo de cejas."""
    
    face_shape: Literal["oval", "round", "square", "heart", "oblong"]
    ideal_brow_start: float = Field(..., ge=0.0, le=1.0)
    ideal_brow_arch: float = Field(..., ge=0.0, le=1.0)
    ideal_brow_end: float = Field(..., ge=0.0, le=1.0)
    symmetry_score: float = Field(..., ge=0.0, le=1.0)
    detected_at: datetime


class TrendAffinity(BaseModel):
    """Afinidad con tendencias."""
    
    category: Literal["ingredientes_activos", "local_colombia", "rutina_cuidado", "glow_estetica"]
    trending_hashtags: list[str]
    match_score: float = Field(..., ge=0.0, le=1.0)
    updated_at: datetime


class EvolutionSnapshot(BaseModel):
    """Snapshot de evolución."""
    
    scan_date: datetime
    beauty_score: int = Field(..., ge=0, le=100)
    skin_concerns_count: int = Field(..., ge=0)
    hair_damage_level: Literal["none", "mild", "moderate", "severe"]
    improvements: list[str] = []


class BeautyProfileResponse(BaseModel):
    """Schema de respuesta de BeautyProfile."""
    
    id: UUID
    user_id: UUID
    skin_subtone: str | None
    skin_subtone_confidence: float | None
    skin_concerns: list[SkinConcern] | None
    hair_diagnosis: HairDiagnosis | None
    hand_morphology: HandMorphology | None
    brow_visajismo: BrowVisajismo | None
    trend_affinity: list[TrendAffinity] | None
    evolution_history: list[EvolutionSnapshot] | None
    beauty_score: int | None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

"""Schema estructurado de resultado de análisis IA."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SkinConcernResult(BaseModel):
    """Preocupación de piel detectada."""
    
    type: Literal["acne", "rosacea", "hyperpigmentation", "pores", "dehydration", "wrinkles"]
    severity: Literal["mild", "moderate", "severe"]
    confidence: float = Field(..., ge=0.0, le=1.0)


class HairDiagnosisResult(BaseModel):
    """Diagnóstico capilar."""
    
    porosity: Literal["low", "medium", "high"]
    damage_level: Literal["none", "mild", "moderate", "severe"]
    hair_type: Literal["straight", "wavy", "curly", "coily"]
    density: Literal["thin", "medium", "thick"]


class HandMorphologyResult(BaseModel):
    """Morfología de manos."""
    
    hand_shape: Literal["square", "oval", "tapered", "spatulate"]
    finger_length: Literal["short", "medium", "long"]
    recommended_nail_shape: Literal["round", "oval", "almond", "coffin", "stiletto"]


class BrowVisajismoResult(BaseModel):
    """Visajismo de cejas."""
    
    face_shape: Literal["oval", "round", "square", "heart", "oblong"]
    ideal_brow_start: float = Field(..., ge=0.0, le=1.0)
    ideal_brow_arch: float = Field(..., ge=0.0, le=1.0)
    ideal_brow_end: float = Field(..., ge=0.0, le=1.0)
    symmetry_score: float = Field(..., ge=0.0, le=1.0)


class RecommendedProduct(BaseModel):
    """Producto recomendado."""
    
    product_type: Literal["serum", "cleanser", "moisturizer", "sunscreen", "mask", "toner"]
    key_ingredients: list[str]
    addresses_concerns: list[str]
    reasoning: str


class RecommendedService(BaseModel):
    """Servicio recomendado."""
    
    service_type: Literal["facial", "hair_treatment", "brow_design", "manicure", "massage"]
    specific_service: str
    reasoning: str


class AIBeautyAnalysisResult(BaseModel):
    """Resultado completo del análisis beauty por IA."""
    
    # Análisis de piel
    skin_subtone: Literal["cold", "warm", "neutral", "unknown"]
    skin_subtone_confidence: float = Field(..., ge=0.0, le=1.0)
    skin_concerns: list[SkinConcernResult]
    
    # Análisis capilar
    hair_diagnosis: HairDiagnosisResult
    
    # Morfología
    hand_morphology: HandMorphologyResult
    brow_visajismo: BrowVisajismoResult
    
    # Insight cruzado (el más importante)
    cross_analysis_insight: str = Field(..., min_length=20, max_length=500)
    
    # Recomendaciones
    recommended_products: list[RecommendedProduct] = Field(..., min_length=2, max_length=5)
    recommended_services: list[RecommendedService] = Field(..., min_length=1, max_length=3)
    
    # Score general
    beauty_score: int = Field(..., ge=0, le=100)
    priority_areas: list[str] = Field(..., min_length=1, max_length=5)
    
    # Afinidad con tendencias (calculada post-análisis, no por IA)
    matched_trending_hashtags: list[str] = Field(default_factory=list)


class OrchestratorMetadata(BaseModel):
    """Metadata del procesamiento del orquestador."""
    
    ai_provider: Literal["gemini", "claude"]
    ai_model: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    processing_time_seconds: float
    retry_count: int
    fallback_used: bool

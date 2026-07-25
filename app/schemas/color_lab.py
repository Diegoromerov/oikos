"""Esquemas Pydantic para el módulo Color Lab."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field


class MoodType(str, Enum):
    EVERYDAY = "everyday"
    POWER = "power"
    WEEKEND = "weekend"
    SPECIAL = "special"
    VACATION = "vacation"


class LightCondition(str, Enum):
    NATURAL = "natural"
    OFFICE = "office"
    NIGHT = "night"
    DIRECT_SUN = "direct_sun"


class ColorDNACreate(BaseModel):
    harmonic_palette: str
    skin_undertone: str
    hair_porosity: str
    forbidden_colors: List[str] = []
    forbidden_reason: Optional[str] = None
    signature_colors: List[str] = []
    adventure_index: float = Field(..., ge=0.0, le=10.0)


class ColorDNAOut(ColorDNACreate):
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class HarmonyScore(BaseModel):
    total: float = Field(..., ge=0.0, le=100.0)
    skin_match: Optional[float] = Field(None, ge=0.0, le=100.0)
    eye_match: Optional[float] = Field(None, ge=0.0, le=100.0)
    trend_match: Optional[float] = Field(None, ge=0.0, le=100.0)
    technical_viability: Optional[float] = Field(None, ge=0.0, le=100.0)
    lifestyle_match: Optional[float] = Field(None, ge=0.0, le=100.0)


class ColorRecommendationCreate(BaseModel):
    color_id: str
    brand_name: str
    color_name: str
    reference: str
    color_value: str
    mood: MoodType
    harmony_score: HarmonyScore
    is_forbidden: bool = False
    extra_metadata: Dict[str, Any] = {}


class ColorRecommendationOut(BaseModel):
    id: UUID
    user_id: UUID
    color_id: str
    brand_name: str
    color_name: str
    reference: str
    color_value: str
    mood: str
    harmony_score: float
    skin_match: Optional[float]
    eye_match: Optional[float]
    trend_match: Optional[float]
    technical_viability: Optional[float]
    lifestyle_match: Optional[float]
    is_forbidden: bool
    extra_metadata: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TryOnHistoryCreate(BaseModel):
    color_id: str
    light_condition: Optional[LightCondition] = None
    screenshot_url: Optional[str] = None
    user_rating: Optional[int] = Field(None, ge=1, le=5)
    user_feedback: Optional[str] = None


class ColorLabResponse(BaseModel):
    color_dna: ColorDNAOut
    recommendations: List[ColorRecommendationOut]
    trending_colors: List[Dict[str, Any]]
    harmony_scores: Dict[str, HarmonyScore]

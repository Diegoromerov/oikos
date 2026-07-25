"""Contexto para construir el prompt multimodal."""

from dataclasses import dataclass, field
from typing import Optional

from app.schemas.beauty_profile import BeautyProfileResponse
from app.schemas.tiktok_hashtag_trend import TikTokHashtagTrendResponse


@dataclass
class PromptContext:
    """Contexto completo para el orquestador."""
    
    # Perfil existente (None si es primer escaneo)
    existing_profile: Optional[BeautyProfileResponse] = None
    
    # Tendencias actuales (top 10)
    trending_hashtags: list[TikTokHashtagTrendResponse] = field(default_factory=list)
    
    # Metadata del usuario
    user_city: str = "Bogotá"
    user_age_range: Optional[str] = None  # "18-25", "26-35", "36-45", "46+"
    
    # Número de escaneo (para contexto histórico)
    scan_number: int = 1

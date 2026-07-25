"""Servicio de lógica de negocio para Color Lab."""

import json
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.color_dna import ColorDNA
from app.models.color_recommendation import ColorRecommendation, ColorTryOnHistory
from app.schemas.color_lab import HarmonyScore, MoodType
from app.services.harmony_calculator import HarmonyCalculator
from app.services.tiktok_trend_service import TikTokTrendService


class ColorLabService:
    """Servicio para gestionar la lógica de Color Lab."""
    
    # Catálogo de tintes y tonos populares en Colombia/LATAM
    COLOR_CATALOG = [
        {
            "color_id": "c1",
            "brand_name": "L'Oréal Paris",
            "color_name": "Rubio Cobrizo Dorado",
            "reference": "7.43",
            "color_value": "#D2691E",
            "undertone": "warm",
            "tone_level": 7,
            "maintenance_level": "high",
            "moods": ["weekend", "special"]
        },
        {
            "color_id": "c2",
            "brand_name": "Wella Koleston",
            "color_name": "Castaño Claro Claro",
            "reference": "5.0",
            "color_value": "#5C4033",
            "undertone": "neutral",
            "tone_level": 5,
            "maintenance_level": "low",
            "moods": ["everyday"]
        },
        {
            "color_id": "c3",
            "brand_name": "Schwarzkopf Igora",
            "color_name": "Rubio Claro Cenizo",
            "reference": "8.1",
            "color_value": "#D8C3A5",
            "undertone": "cold",
            "tone_level": 8,
            "maintenance_level": "high",
            "moods": ["power", "special"]
        },
        {
            "color_id": "c4",
            "brand_name": "Revlon Colorsilk",
            "color_name": "Negro Luminoso",
            "reference": "1.0",
            "color_value": "#0A0A0A",
            "undertone": "cold",
            "tone_level": 1,
            "maintenance_level": "low",
            "moods": ["power", "everyday"]
        },
        {
            "color_id": "c5",
            "brand_name": "Wella Professionals",
            "color_name": "Chocolate Dorado",
            "reference": "6.7",
            "color_value": "#4B382A",
            "undertone": "warm",
            "tone_level": 6,
            "maintenance_level": "medium",
            "moods": ["everyday", "weekend"]
        },
        {
            "color_id": "c6",
            "brand_name": "L'Oréal Excellence",
            "color_name": "Rojo Borgoña Intenso",
            "reference": "4.26",
            "color_value": "#58111A",
            "undertone": "cold",
            "tone_level": 4,
            "maintenance_level": "high",
            "moods": ["special", "vacation"]
        },
        {
            "color_id": "c7",
            "brand_name": "Schwarzkopf Palette",
            "color_name": "Rubio Miel",
            "reference": "7.3",
            "color_value": "#C68E17",
            "undertone": "warm",
            "tone_level": 7,
            "maintenance_level": "medium",
            "moods": ["vacation", "weekend"]
        }
    ]

    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def generate_color_dna(self, user_id: UUID, beauty_profile: Dict[str, Any]) -> ColorDNA:
        """Genera el Color DNA del usuario y recalcula recomendaciones."""
        skin_undertone = beauty_profile.get('skin_subtone', 'neutral')
        
        # hair_diagnosis puede ser un dict o un modelo ORM
        hair_diag = beauty_profile.get('hair_diagnosis')
        if not isinstance(hair_diag, dict):
            hair_diag = {
                'porosity': getattr(hair_diag, 'porosity', 'medium'),
                'damage_level': getattr(hair_diag, 'damage_level', 'medium'),
            } if hair_diag else {}

        harmonic_palette = self._determine_harmonic_palette(skin_undertone)
        forbidden_colors, forbidden_reason = self._determine_forbidden_colors(
            skin_undertone, hair_diag
        )
        signature_colors = self._determine_signature_colors(skin_undertone)
        adventure_index = self._calculate_adventure_index(beauty_profile)
        
        # Eliminar si ya existe un ADN previo
        await self.db.execute(delete(ColorDNA).where(ColorDNA.user_id == user_id))
        
        color_dna = ColorDNA(
            user_id=user_id,
            harmonic_palette=harmonic_palette,
            skin_undertone=skin_undertone,
            hair_porosity=hair_diag.get('porosity', 'medium'),
            forbidden_colors=forbidden_colors,
            forbidden_reason=forbidden_reason,
            signature_colors=signature_colors,
            adventure_index=adventure_index
        )
        
        self.db.add(color_dna)
        await self.db.flush()
        
        # Regenerar recomendaciones por defecto para cada mood
        await self.db.execute(delete(ColorRecommendation).where(ColorRecommendation.user_id == user_id))
        
        trends_service = TikTokTrendService(self.db)
        trends_list = await trends_service.get_trending_hashtags(limit=10)
        trends = {
            "trending_colors": [{"hashtag": t.hashtag, "growth_percentage": t.growth_percentage} for t in trends_list]
        }
        
        for color_item in self.COLOR_CATALOG:
            harmony = HarmonyCalculator.calculate(
                beauty_profile=beauty_profile,
                color_data=color_item,
                trends=trends
            )
            
            is_forbidden = color_item['color_id'] in forbidden_colors
            
            for mood in color_item['moods']:
                rec = ColorRecommendation(
                    user_id=user_id,
                    color_id=color_item['color_id'],
                    brand_name=color_item['brand_name'],
                    color_name=color_item['color_name'],
                    reference=color_item['reference'],
                    color_value=color_item['color_value'],
                    mood=mood,
                    harmony_score=harmony.total,
                    skin_match=harmony.skin_match,
                    eye_match=harmony.eye_match,
                    trend_match=harmony.trend_match,
                    technical_viability=harmony.technical_viability,
                    lifestyle_match=harmony.lifestyle_match,
                    is_forbidden=is_forbidden,
                    extra_metadata={"tone_level": color_item['tone_level'], "maintenance_level": color_item['maintenance_level']}
                )
                self.db.add(rec)
        
        await self.db.flush()
        return color_dna

    async def get_recommendations(
        self,
        user_id: UUID,
        mood: Optional[MoodType] = None,
        limit: int = 20
    ) -> List[ColorRecommendation]:
        """Obtiene las recomendaciones de color guardadas para el usuario."""
        query = select(ColorRecommendation).where(
            ColorRecommendation.user_id == user_id
        )
        
        if mood:
            query = query.where(ColorRecommendation.mood == mood.value)
        
        query = query.order_by(ColorRecommendation.harmony_score.desc()).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def save_try_on_history(
        self,
        user_id: UUID,
        color_id: str,
        light_condition: Optional[str] = None,
        screenshot_url: Optional[str] = None
    ) -> ColorTryOnHistory:
        """Guarda un registro de simulación Try-On AR."""
        try_on = ColorTryOnHistory(
            user_id=user_id,
            color_id=color_id,
            light_condition=light_condition,
            screenshot_url=screenshot_url
        )
        
        self.db.add(try_on)
        await self.db.flush()
        return try_on
    
    def _determine_harmonic_palette(self, skin_undertone: str) -> str:
        palettes = {
            "warm": "Autumn Warm Gold",
            "cold": "Winter Cool Silver",
            "neutral": "Spring Balanced Natural"
        }
        return palettes.get(skin_undertone.lower(), "Spring Balanced Natural")
    
    def _determine_forbidden_colors(self, skin_undertone: str, hair_diagnosis: Dict[str, Any]) -> tuple:
        forbidden = []
        reason = ""
        
        if skin_undertone.lower() == "warm":
            forbidden = ["c3", "c4"] # Igora Cenizo, Negro Luminoso
            reason = "Los tonos cenizos o negros muy frios pueden apagar la calidez natural de tu piel"
        
        damage_level = hair_diagnosis.get('damage_level', 'medium')
        if damage_level == 'high':
            forbidden.append("c1") # Rubio Cobrizo Dorado requiere aclaración intensa
            reason += " Adicionalmente, tu cabello presenta daño alto, por lo que debes evitar decoloraciones extremas"
        
        return forbidden, reason.strip()
    
    def _determine_signature_colors(self, skin_undertone: str) -> List[str]:
        if skin_undertone.lower() == "warm":
            return ["c1", "c5", "c7"] # Cobrizo, Chocolate Dorado, Rubio Miel
        elif skin_undertone.lower() == "cold":
            return ["c3", "c4", "c6"] # Cenizo, Negro, Borgoña
        else:
            return ["c2", "c5"] # Castaño Claro, Chocolate Dorado
    
    def _calculate_adventure_index(self, beauty_profile: Dict[str, Any]) -> float:
        # Puntuación de audacia estética por defecto
        return 6.5

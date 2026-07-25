"""Calculadora del Harmony Score™ de Color Lab."""

from typing import Dict, Any, Optional
from app.schemas.color_lab import HarmonyScore


class HarmonyCalculator:
    """
    Calcula el Harmony Score™ basado en múltiples factores.
    Fórmula: Total = (Skin×0.30) + (Eye×0.20) + (Trend×0.20) + (Tech×0.15) + (Life×0.15)
    """
    
    @staticmethod
    def calculate(
        beauty_profile: Dict[str, Any],
        color_data: Dict[str, Any],
        trends: Optional[Dict[str, Any]] = None
    ) -> HarmonyScore:
        skin_match = HarmonyCalculator._calculate_skin_match(
            beauty_profile.get('skin_subtone'),
            color_data.get('undertone'),
            color_data.get('tone_level', 5)
        )
        
        eye_match = HarmonyCalculator._calculate_eye_match(
            beauty_profile.get('eye_color'),
            color_data.get('color_value', '')
        )
        
        trend_match = HarmonyCalculator._calculate_trend_match(
            color_data.get('reference', ''),
            trends
        )
        
        # hair_diagnosis puede ser un dict o un objeto en base a cómo esté modelado
        hair_diag = beauty_profile.get('hair_diagnosis')
        if not isinstance(hair_diag, dict):
            # Si es un objeto de BD, intentamos convertirlo o leer sus campos
            hair_diag = {
                'damage_level': getattr(hair_diag, 'damage_level', 'medium'),
                'porosity': getattr(hair_diag, 'porosity', 'medium'),
                'current_level': getattr(hair_diag, 'current_level', 5),
            } if hair_diag else {}

        technical_viability = HarmonyCalculator._calculate_technical_viability(
            hair_diag,
            color_data
        )
        
        lifestyle_match = HarmonyCalculator._calculate_lifestyle_match(
            beauty_profile,
            color_data.get('maintenance_level', 'medium')
        )
        
        total = (
            skin_match * 0.30 +
            eye_match * 0.20 +
            trend_match * 0.20 +
            technical_viability * 0.15 +
            lifestyle_match * 0.15
        )
        
        return HarmonyScore(
            total=round(total, 2),
            skin_match=round(skin_match, 2),
            eye_match=round(eye_match, 2),
            trend_match=round(trend_match, 2),
            technical_viability=round(technical_viability, 2),
            lifestyle_match=round(lifestyle_match, 2)
        )
    
    @staticmethod
    def _calculate_skin_match(skin_undertone: Optional[str], color_undertone: Optional[str], tone_level: int) -> float:
        if not skin_undertone:
            skin_undertone = "neutral"
        if not color_undertone:
            color_undertone = "neutral"

        skin_undertone = skin_undertone.lower()
        color_undertone = color_undertone.lower()

        if skin_undertone == color_undertone:
            base_score = 95.0
        elif skin_undertone == "neutral" or color_undertone == "neutral":
            base_score = 85.0
        else:
            base_score = 60.0
        
        contrast_bonus = 0
        if skin_undertone == "warm" and tone_level >= 7:
            contrast_bonus = 5
        elif skin_undertone == "cold" and tone_level <= 4:
            contrast_bonus = 5
        
        return min(100.0, base_score + contrast_bonus)
    
    @staticmethod
    def _calculate_eye_match(eye_color: Optional[str], color_value: str) -> float:
        if not eye_color:
            return 75.0
        
        complementary_pairs = {
            "brown": ["copper", "golden", "warm_brown"],
            "blue": ["warm_blonde", "copper", "golden"],
            "green": ["red", "auburn", "warm_tones"],
            "hazel": ["warm_brown", "copper", "golden"]
        }
        
        eye_color_lower = eye_color.lower()
        for key, values in complementary_pairs.items():
            if key in eye_color_lower:
                if any(v in color_value.lower() for v in values):
                    return 90.0
        
        return 70.0
    
    @staticmethod
    def _calculate_trend_match(color_reference: str, trends: Optional[Dict[str, Any]]) -> float:
        if not trends:
            return 50.0
        
        trending_colors = trends.get('trending_colors', [])
        for trend in trending_colors:
            if color_reference.lower() in trend.get('hashtag', '').lower():
                growth = trend.get('growth_percentage', 0)
                return min(100.0, 50.0 + (growth / 2.0))
        
        return 40.0
    
    @staticmethod
    def _calculate_technical_viability(hair_diagnosis: Dict[str, Any], color_data: Dict[str, Any]) -> float:
        damage_level = hair_diagnosis.get('damage_level', 'medium')
        porosity = hair_diagnosis.get('porosity', 'medium')
        target_level = color_data.get('tone_level', 5)
        
        base_score = 100.0
        
        if damage_level == 'high':
            base_score -= 20
        elif damage_level == 'medium':
            base_score -= 10
        
        if porosity == 'high':
            base_score -= 15
        
        current_level = hair_diagnosis.get('current_level', 5)
        level_difference = target_level - current_level
        
        if level_difference > 3:
            base_score -= 25
        elif level_difference > 2:
            base_score -= 15
        
        return max(0.0, base_score)
    
    @staticmethod
    def _calculate_lifestyle_match(beauty_profile: Dict[str, Any], maintenance_level: str) -> float:
        if maintenance_level == 'high':
            return 60.0
        elif maintenance_level == 'medium':
            return 80.0
        else:
            return 95.0

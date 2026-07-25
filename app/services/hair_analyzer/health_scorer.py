"""Servicio para calcular puntajes de salud capilar."""

from typing import Dict, Any
from app.schemas.hair_analyzer import HairHealthScore


class HairHealthScorer:
    """Calculadora matemática de Hair Health Score™."""
    
    def calculate(self, diagnostic: Dict[str, Any]) -> HairHealthScore:
        """
        Calcula el score de salud general.
        Fórmula: overall = (moisture×0.35) + (elasticity×0.35) + ((100 - damage)×0.30)
        """
        moisture = float(diagnostic.get("moisture_level", 50.0))
        elasticity = float(diagnostic.get("elasticity_score", 50.0))
        damage = float(diagnostic.get("damage_index", 0.0))
        
        overall = (moisture * 0.35) + (elasticity * 0.35) + ((100.0 - damage) * 0.30)
        
        # Puntuación de cuero cabelludo (scalp) por defecto basado en grasa/canas
        scalp_health = 85.0
        
        return HairHealthScore(
            overall=round(overall, 2),
            damage_index=round(damage, 2),
            moisture_level=round(moisture, 2),
            elasticity_score=round(elasticity, 2),
            scalp_health=round(scalp_health, 2)
        )

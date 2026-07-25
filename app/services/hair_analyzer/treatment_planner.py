"""Generador de planes de tratamiento inteligente capilar por IA."""

from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.hair_analyzer import HairHealthScore, TreatmentPlanOut


class TreatmentPlanner:
    """Diseña la rutina y plan de mantenimiento capilar según el estado del cabello."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        
    def generate_plan(self, diagnostic: Dict[str, Any], health: HairHealthScore) -> TreatmentPlanOut:
        """Genera el plan de tratamiento usando reglas clínicas."""
        damage = health.damage_index
        porosity = diagnostic.get("porosity_level", "medium").lower()
        
        # 1. Determinar si necesita tratamiento de proteínas (daño alto)
        protein_needed = damage > 60.0
        protein_freq = 15 if protein_needed else None
        
        # 2. Productos recomendados según catálogo y diagnóstico
        shampoos = ["L'Oréal Elvive Hialurónico Pure"]
        masks = ["Tratamiento Hidratante CeraVe"]
        conditioners = ["Acondicionador Kérastase Discipline"]
        
        if damage > 70.0:
            masks.append("Kérastase Resistance Ciment Thermique")
            
        # 3. Frecuencia de corte e ingredientes a evitar
        trim_cm = 1.5 if damage > 50.0 else 0.5
        trim_weeks = 8 if damage > 50.0 else 12
        
        avoid = ["sulfates", "parabens"]
        if porosity == "high":
            avoid.append("heavy_silicones")
            
        return TreatmentPlanOut(
            recommended_shampoos=shampoos,
            recommended_conditioners=conditioners,
            recommended_masks=masks,
            protein_treatment_needed=protein_needed,
            protein_frequency_days=protein_freq,
            heat_protection_required=True,
            trim_recommendation_cm=trim_cm,
            trim_frequency_weeks=trim_weeks,
            ingredients_to_avoid=avoid
        )

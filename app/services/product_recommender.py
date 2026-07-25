"""Servicio inteligente de recomendación de productos (skincare, hair care, color)."""

from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beauty_profile import BeautyProfile
from app.models.color_dna import ColorDNA


class ProductRecommender:
    """Recomendador de productos basado en colorimetría y diagnóstico capilar/cutáneo."""
    
    # Catálogo estático de productos locales premium en Colombia/LATAM
    PRODUCT_CATALOG = [
        {
            "id": "p1",
            "name": "L'Oréal Elvive Hialurónico Pure",
            "category": "hair_care",
            "type": "shampoo",
            "price": 28900.00,
            "description": "Shampoo purificante e hidratante para raíces grasas y puntas deshidratadas.",
            "target_porosity": ["medium", "high"],
            "target_damage": ["low", "medium"],
            "skin_type": "any",
            "match_bonus": 15
        },
        {
            "id": "p2",
            "name": "La Roche-Posay Effaclar Gel",
            "category": "skin_care",
            "type": "limpiador",
            "price": 89900.00,
            "description": "Gel limpiador purificante para pieles grasas y sensibles.",
            "target_porosity": [],
            "target_damage": [],
            "skin_type": "oily",
            "match_bonus": 20
        },
        {
            "id": "p3",
            "name": "Kérastase Resistance Ciment Thermique",
            "category": "hair_care",
            "type": "crema_peinar",
            "price": 165000.00,
            "description": "Tratamiento reconstructor termo-protector para cabello debilitado y dañado.",
            "target_porosity": ["high"],
            "target_damage": ["medium", "high"],
            "skin_type": "any",
            "match_bonus": 25
        },
        {
            "id": "p4",
            "name": "CeraVe Crema Hidratante Facial",
            "category": "skin_care",
            "type": "hidratante",
            "price": 64900.00,
            "description": "Hidratación profunda con 3 ceramidas esenciales para piel seca a normal.",
            "target_porosity": [],
            "target_damage": [],
            "skin_type": "dry",
            "match_bonus": 15
        },
        {
            "id": "p5",
            "name": "Tinte Majirel Rubio Cobre Dorado 7.43",
            "category": "hair_color",
            "type": "tinte",
            "price": 42000.00,
            "description": "Tinte de oxidación permanente Majirel de L'Oréal Professionnel.",
            "target_porosity": ["low", "medium"],
            "target_damage": ["none", "low", "medium"],
            "skin_type": "any",
            "match_bonus": 30,
            "color_code": "c1"
        },
        {
            "id": "p6",
            "name": "Tinte Igora Cenizo Claro 8.1",
            "category": "hair_color",
            "type": "tinte",
            "price": 38900.00,
            "description": "Coloración permanente en crema Schwarzkopf Igora Royal.",
            "target_porosity": ["low", "medium"],
            "target_damage": ["none", "low", "medium"],
            "skin_type": "any",
            "match_bonus": 30,
            "color_code": "c3"
        }
    ]

    def __init__(self, db: AsyncSession):
        self.db = db
        
    async def get_recommended_products(self, user_id: UUID) -> List[Dict[str, Any]]:
        """Genera y puntúa recomendaciones personalizadas para el usuario."""
        # 1. Obtener perfil de belleza
        bp_stmt = select(BeautyProfile).where(BeautyProfile.user_id == user_id)
        bp_result = await self.db.execute(bp_stmt)
        beauty_profile = bp_result.scalar_one_or_none()
        
        # 2. Obtener Color DNA
        dna_stmt = select(ColorDNA).where(ColorDNA.user_id == user_id)
        dna_result = await self.db.execute(dna_stmt)
        color_dna = dna_result.scalar_one_or_none()
        
        # Valores por defecto para mock si no existen
        skin_subtone = beauty_profile.skin_subtone if beauty_profile else "neutral"
        hair_diag = beauty_profile.hair_diagnosis if beauty_profile else {}
        porosity = hair_diag.get("porosity", "medium")
        damage = hair_diag.get("damage_level", "medium")
        skin_type = "oily" # por defecto
        
        forbidden_colors = color_dna.forbidden_colors if color_dna else []
        
        recommended_list = []
        
        for p in self.PRODUCT_CATALOG:
            # Filtro de seguridad: si el producto es un tinte prohibido por Color DNA, omitir
            if p["category"] == "hair_color" and p.get("color_code") in forbidden_colors:
                continue
                
            # Calcular afinidad base (60%)
            affinity = 70.0
            
            # Puntuación por porosidad y daño del cabello
            if p["category"] == "hair_care":
                if porosity in p["target_porosity"]:
                    affinity += 10.0
                if damage in p["target_damage"]:
                    affinity += 10.0
                    
            # Puntuación por tipo de piel (skincare)
            if p["category"] == "skin_care":
                if p["skin_type"] == skin_type:
                    affinity += 15.0
                else:
                    affinity -= 10.0
                    
            # Puntuación por Color DNA en tintes
            if p["category"] == "hair_color" and color_dna:
                if p.get("color_code") in color_dna.signature_colors:
                    affinity += 20.0
                    
            # Acotar puntaje
            affinity = min(100.0, max(40.0, affinity))
            
            # Construir dict final del producto
            prod_entry = p.copy()
            prod_entry["affinity_score"] = round(affinity, 2)
            prod_entry["badge"] = "RECOMENDADO" if affinity >= 85 else "BUENA OPCIÓN"
            recommended_list.append(prod_entry)
            
        # Ordenar por afinidad descendente
        recommended_list.sort(key=lambda x: x["affinity_score"], reverse=True)
        return recommended_list

    async def get_bundles(self, user_id: UUID) -> List[Dict[str, Any]]:
        """Agrupa productos en combos promocionales a la medida."""
        prods = await self.get_recommended_products(user_id)
        
        # Buscar el mejor producto de cabello y de piel para armar el Bundle principal
        hair_prods = [p for p in prods if p["category"] == "hair_care"]
        skin_prods = [p for p in prods if p["category"] == "skin_care"]
        color_prods = [p for p in prods if p["category"] == "hair_color"]
        
        bundles = []
        
        if hair_prods and color_prods:
            # Bundle 1: Cambio de Look Protegido (Tinte + Cuidado Reconstructor)
            tinte = color_prods[0]
            cuidado = hair_prods[0]
            total_original = tinte["price"] + cuidado["price"]
            total_discounted = total_original * 0.85 # 15% Descuento
            
            bundles.append({
                "id": "b1",
                "name": "Kit Cambio de Look Radiante",
                "description": "Combina tu tinte ideal con el mejor tratamiento reconstructor post-coloración.",
                "original_price": round(total_original, 2),
                "price": round(total_discounted, 2),
                "discount_percentage": 15,
                "products": [tinte, cuidado],
                "badge": "MÁXIMA AFINIDAD"
            })
            
        if skin_prods:
            # Bundle 2: Skincare Diario Glow
            sk_items = skin_prods[:2]
            total_original = sum(item["price"] for item in sk_items)
            total_discounted = total_original * 0.90 # 10% Descuento
            
            bundles.append({
                "id": "b2",
                "name": "Duo Skincare Pure Glow",
                "description": "Rutina básica purificante e hidratante recomendada para tu tipo de piel.",
                "original_price": round(total_original, 2),
                "price": round(total_discounted, 2),
                "discount_percentage": 10,
                "products": sk_items,
                "badge": "PRECIO ESPECIAL"
            })
            
        return bundles

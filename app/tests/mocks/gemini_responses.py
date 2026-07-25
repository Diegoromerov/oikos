"""Mock responses from Gemini and Claude."""

VALID_RESPONSE = """
{
  "skin_subtone": "warm",
  "skin_subtone_confidence": 0.87,
  "skin_concerns": [
    {
      "type": "dehydration",
      "severity": "mild",
      "confidence": 0.92
    },
    {
      "type": "pores",
      "severity": "moderate",
      "confidence": 0.85
    }
  ],
  "hair_diagnosis": {
    "porosity": "medium",
    "damage_level": "mild",
    "hair_type": "wavy",
    "density": "medium"
  },
  "hand_morphology": {
    "hand_shape": "oval",
    "finger_length": "medium",
    "recommended_nail_shape": "almond"
  },
  "brow_visajismo": {
    "face_shape": "oval",
    "ideal_brow_start": 0.25,
    "ideal_brow_arch": 0.65,
    "ideal_brow_end": 0.90,
    "symmetry_score": 0.88
  },
  "cross_analysis_insight": "El nivel de porosidad media del cabello es consistente con la deshidratación leve en la zona T del rostro.",
  "recommended_products": [
    {
      "product_type": "serum",
      "key_ingredients": ["niacinamida", "ácido hialurónico"],
      "addresses_concerns": ["pores", "dehydration"],
      "reasoning": "Regula el sebo y aporta hidratación profunda."
    },
    {
      "product_type": "moisturizer",
      "key_ingredients": ["bakuchiol"],
      "addresses_concerns": ["dehydration"],
      "reasoning": "Hidrata sin engrasar y mejora la textura general."
    }
  ],
  "recommended_services": [
    {
      "service_type": "facial",
      "specific_service": "Limpieza profunda hidratante",
      "reasoning": "Desobstruye poros y combate la deshidratación."
    }
  ],
  "beauty_score": 78,
  "priority_areas": ["Piel - hidratación", "Poros"],
  "matched_trending_hashtags": ["#niacinamida", "#bakuchiol"]
}
"""

RESPONSE_WITH_MARKDOWN = f"""
Aquí tienes el análisis en formato JSON:
```json
{VALID_RESPONSE}
```
Espero que te sea útil.
"""

INVALID_JSON = """
{
"skin_subtone": "warm",
"skin_subtone_confidence": 0.87,
"skin_concerns": [
// Este comentario rompe el JSON
{
"type": "dehydration",
"severity": "mild",
"confidence": 0.92
}
]
"""

MISSING_REQUIRED_FIELDS = """{
"skin_subtone": "warm",
"skin_subtone_confidence": 0.87
}"""

INVALID_VALUES = """{
"skin_subtone": "invalid_value",
"skin_subtone_confidence": 1.5,
"skin_concerns": [],
"hair_diagnosis": {
"porosity": "invalid",
"damage_level": "invalid",
"hair_type": "invalid",
"density": "invalid"
},
"hand_morphology": {
"hand_shape": "invalid",
"finger_length": "invalid",
"recommended_nail_shape": "invalid"
},
"brow_visajismo": {
"face_shape": "invalid",
"ideal_brow_start": 2.0,
"ideal_brow_arch": 2.0,
"ideal_brow_end": 2.0,
"symmetry_score": 2.0
},
"cross_analysis_insight": "x",
"recommended_products": [],
"recommended_services": [],
"beauty_score": 150,
"priority_areas": []
}"""

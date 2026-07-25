"""Constructor del prompt multimodal para el orquestador."""

import json

from app.core.logging import get_logger
from app.schemas.ai.analysis_result import AIBeautyAnalysisResult
from app.schemas.ai.prompt_context import PromptContext

logger = get_logger(__name__)


class PromptBuilder:
    """
    Construye el prompt multimodal para el orquestador de IA.
    
    El prompt tiene 7 secciones:
    1. Rol y contexto general
    2. Descripción de las imágenes
    3. Contexto histórico (si existe)
    4. Tendencias actuales (inyectadas)
    5. Instrucciones de análisis (7 pasos)
    6. Formato de salida (JSON estricto)
    7. Validaciones críticas
    """
    
    def build(self, context: PromptContext) -> str:
        """Construye el prompt completo."""
        
        sections = [
            self._section_role_and_context(),
            self._section_images_description(),
            self._section_historical_context(context),
            self._section_trends(context),
            self._section_analysis_instructions(),
            self._section_output_format(),
            self._section_validations(),
        ]
        
        return "\n\n".join(sections)
    
    def _section_role_and_context(self) -> str:
        return """# ROL Y CONTEXTO

Eres un experto en diagnóstico beauty integral con 20 años de experiencia en:
- Dermatología estética
- Tricología (ciencia del cabello)
- Visajismo y morfología facial
- Colorimetría aplicada a la belleza

Tu tarea es analizar 4 imágenes del mismo usuario en un SOLO razonamiento integrado,
identificando patrones cruzados entre piel, cabello, manos y rostro.

IMPORTANTE: No eres un médico. Tu análisis es ESTÉTICO, no diagnóstico médico.
Si detectas algo que podría ser un problema de salud (ej: lunar sospechoso),
indícalo claramente y recomienda consultar a un dermatólogo."""
    
    def _section_images_description(self) -> str:
        return """# IMÁGENES PROPORCIONADAS

Recibirás 4 imágenes del mismo usuario en este orden:

1. **Rostro frontal**: Para análisis de subtono de piel, preocupaciones faciales, 
   visajismo de cejas y forma del rostro.

2. **Rostro lateral**: Para análisis de perfil facial, estructura ósea y cuello.

3. **Cabello (primer plano)**: Para diagnóstico de salud capilar (porosidad, daño, 
   tipo, densidad).

4. **Mano abierta**: Para análisis morfológico (forma de mano, longitud de dedos) 
   y recomendación de forma de uña ideal."""
    
    def _section_historical_context(self, context: PromptContext) -> str:
        if not context.existing_profile:
            return """# CONTEXTO HISTÓRICO

Este es el PRIMER escaneo del usuario. No hay datos previos para comparar.
Realiza el análisis desde cero."""
        
        profile = context.existing_profile
        
        # Mapear preocupaciones anteriores
        skin_concerns_list = []
        if profile.skin_concerns:
            for c in profile.skin_concerns:
                # skin_concerns en db tiene detected_at, pero para prompt nos interesa type, severity y confidence
                skin_concerns_list.append({
                    "type": c.type,
                    "severity": c.severity,
                    "confidence": c.confidence
                })
        
        hair_diag_dict = {}
        if profile.hair_diagnosis:
            hair_diag_dict = {
                "porosity": profile.hair_diagnosis.porosity,
                "damage_level": profile.hair_diagnosis.damage_level,
                "hair_type": profile.hair_diagnosis.hair_type,
                "density": profile.hair_diagnosis.density
            }
        
        return f"""# CONTEXTO HISTÓRICO

Este es el escaneo #{context.scan_number} del usuario. Datos previos:

- Subtono de piel anterior: {profile.skin_subtone}
- Beauty Score anterior: {profile.beauty_score}/100
- Preocupaciones anteriores: {json.dumps(skin_concerns_list, indent=2)}
- Diagnóstico capilar anterior: {json.dumps(hair_diag_dict, indent=2)}

INSTRUCCIÓN: Compara el análisis actual con el histórico. Si hay mejoras o empeoramientos,
menciónalos en el cross_analysis_insight. Si el subtono de piel anterior era 'warm',
mantén consistencia a menos que haya evidencia visual clara de lo contrario."""
    
    def _section_trends(self, context: PromptContext) -> str:
        if not context.trending_hashtags:
            return """# TENDENCIAS ACTUALES

No hay tendencias disponibles en este momento.
Genera recomendaciones basadas únicamente en el análisis visual."""
        
        # Separar tendencias por categoría
        ingredients = [t for t in context.trending_hashtags if t.category == "ingredientes_activos"]
        local = [t for t in context.trending_hashtags if t.category == "local_colombia"]
        routines = [t for t in context.trending_hashtags if t.category == "rutina_cuidado"]
        
        trends_text = "## Ingredientes trending:\n"
        for t in ingredients[:5]:
            trends_text += f"- #{t.hashtag} ({t.growth_percentage:+.0f}% crecimiento, {t.volume:,} vistas)\n"
        
        trends_text += "\n## Tendencias locales Colombia:\n"
        for t in local[:3]:
            trends_text += f"- #{t.hashtag} ({t.growth_percentage:+.0f}% crecimiento)\n"
        
        trends_text += "\n## Rutinas trending:\n"
        for t in routines[:3]:
            trends_text += f"- #{t.hashtag} ({t.growth_percentage:+.0f}% crecimiento)\n"
        
        return f"""# TENDENCIAS ACTUALES DEL MERCADO (COLOMBIA)

Estas son las tendencias actuales de belleza en TikTok Colombia.
INSTRUCCIÓN CRÍTICA: Integra estas tendencias en tus recomendaciones SOLO si aplican 
al perfil visual del usuario. NO fuerces la inclusión de tendencias irrelevantes.

{trends_text}

Ejemplo de integración correcta:
- Si el usuario tiene piel deshidratada Y bakuchiol está trending → recomendar bakuchiol
- Si el usuario está en Bogotá Y #bogotabeauty está trending → mencionar en matched_trending_hashtags
- Si el usuario tiene acné Y niacinamida está trending → recomendar productos con niacinamida

Ejemplo de integración INCORRECTA:
- Recomendar bakuchiol solo porque está trending, aunque el usuario no lo necesite
- Forzar hashtags locales si el análisis no tiene relación con Colombia"""
    
    def _section_analysis_instructions(self) -> str:
        return """# INSTRUCCIONES DE ANÁLISIS (7 PASOS)

Realiza el análisis en este orden EXACTO:

## 1. SUBTONO DE PIEL
- Analiza el tono de piel en el rostro frontal (mejillas, frente, mandíbula)
- Clasifica como: 'cold' (rosado/azulado), 'warm' (amarillo/dorado), 'neutral', o 'unknown'
- Proporciona confidence_score (0.0 a 1.0)
- CRÍTICO: Este subtono debe ser CONSISTENTE con todas las recomendaciones posteriores

## 2. PREOCUPACIONES DE PIEL
- Detecta: acne, rosacea, hyperpigmentation, pores, dehydration, wrinkles
- Para cada preocupación, clasifica severidad: mild, moderate, severe
- Proporciona confidence para cada detección
- Si no detectas ninguna preocupación, retorna lista vacía

## 3. DIAGNÓSTICO CAPILAR
- Analiza la imagen de cabello
- Determina: porosity (low/medium/high), damage_level (none/mild/moderate/severe)
- Identifica: hair_type (straight/wavy/curly/coily), density (thin/medium/thick)

## 4. MORFOLOGÍA DE MANOS
- Analiza la imagen de mano abierta
- Determina: hand_shape, finger_length
- Recomienda: forma de uña ideal
  - Dedos cortos → round u oval (alargan visualmente)
  - Dedos largos → almond, coffin o stiletto
  - Manos cuadradas → oval o almond (suavizan)
  - Manos estrechas → round o square (equilibran)

## 5. VISAJISMO DE CEJAS
- Analiza rostro frontal y lateral
- Determina: face_shape (oval/round/square/heart/oblong)
- Calcula proporciones ideales de cejas (start, arch, end como % del ancho facial)
- Calcula symmetry_score (0.0 a 1.0)

## 6. CRUCE DE DATOS (RAZONAMIENTO INTEGRADO)
- Identifica patrones cruzados:
  * "Piel grasa + cabello graso = misma causa hormonal"
  * "Piel deshidratada + cabello seco = falta de hidratación sistémica"
  * "Manchas + arrugas = fotoenvejecimiento"
- Detecta contradicciones y resuélvelas
- Genera UN insight cruzado principal (máximo 500 caracteres)

## 7. RECOMENDACIONES INTEGRADAS
- Sugiere 2-5 productos cosméticos específicos
- Sugiere 1-3 servicios profesionales
- Prioriza productos/servicios que aborden MÚLTIPLES preocupaciones
- Integra tendencias del mercado SOLO si aplican"""
    
    def _section_output_format(self) -> str:
        schema = AIBeautyAnalysisResult.model_json_schema()
        return f"""# FORMATO DE SALIDA (JSON ESTRICTO)

Retorna UN SOLO objeto JSON con esta estructura EXACTA:

```json
{json.dumps(schema, indent=2)}
```"""

    def _section_validations(self) -> str:
        return """# VALIDACIONES CRÍTICAS

1. **JSON Estricto**: Retorna ÚNICAMENTE un objeto JSON. No agregues texto antes ni después del bloque de código JSON.
2. **Campos Requeridos**: Asegúrate de incluir todos los campos obligatorios del esquema (beauty_score, priority_areas, cross_analysis_insight, etc.).
3. **Subtono de Piel**: La skin_subtone elegida ('cold', 'warm', 'neutral') debe ser consistente con la recomendación de colorimetría y productos.
4. **Valores válidos**: Los campos de Literal (como severity o porosity) deben usar estrictamente los valores definidos.
5. **No fuerces tendencias**: Recomienda ingredientes trending o rutinas trending únicamente si se adaptan a las preocupaciones y morfología detectadas del usuario."""

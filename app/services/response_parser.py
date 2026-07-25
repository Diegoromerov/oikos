"""Parser de respuesta JSON de IA con validación estricta."""

import json
import re

from pydantic import ValidationError

from app.core.logging import get_logger
from app.schemas.ai.analysis_result import AIBeautyAnalysisResult
from app.services.ai.base import InvalidResponseError

logger = get_logger(__name__)


class ResponseParser:
    """
    Parser de respuestas JSON de IA.
    
    Maneja:
    - Respuestas con markdown (```json ... ```)
    - Respuestas con texto adicional antes/después del JSON
    - Respuestas mal formateadas
    - Validación estricta con Pydantic
    """
    
    def parse(self, raw_response: str, provider: str) -> AIBeautyAnalysisResult:
        """
        Parsea y valida la respuesta de IA.
        
        Args:
            raw_response: Texto crudo de la respuesta
            provider: Nombre del proveedor (para logging)
        
        Returns:
            AIBeautyAnalysisResult validado
        
        Raises:
            InvalidResponseError: Si no se puede parsear o validar
        """
        # Paso 1: Extraer JSON de la respuesta
        json_str = self._extract_json(raw_response)
        
        # Paso 2: Parsear JSON
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(
                "json_parse_failed",
                provider=provider,
                error=str(e),
                response_preview=raw_response[:500],
            )
            raise InvalidResponseError(
                f"No se pudo parsear JSON: {e}",
                provider=provider,
            )
        
        # Paso 3: Validar con Pydantic
        try:
            result = AIBeautyAnalysisResult.model_validate(data)
        except ValidationError as e:
            logger.error(
                "validation_failed",
                provider=provider,
                errors=e.errors(),
                data_preview=json.dumps(data, indent=2)[:1000],
            )
            raise InvalidResponseError(
                f"Validación fallida: {e.errors()}",
                provider=provider,
            )
        
        logger.info(
            "response_parsed_successfully",
            provider=provider,
            beauty_score=result.beauty_score,
            concerns_count=len(result.skin_concerns),
            products_count=len(result.recommended_products),
        )
        
        return result
    
    def _extract_json(self, text: str) -> str:
        """
        Extrae JSON de texto que puede contener markdown o texto adicional.
        
        Estrategias:
        1. Buscar bloque ```json ... ```
        2. Buscar primer { y último }
        3. Si nada funciona, retornar texto completo
        """
        # Estrategia 1: Bloque markdown
        markdown_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
        match = re.search(markdown_pattern, text)
        if match:
            return match.group(1).strip()
        
        # Estrategia 2: Primer { y último }
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            return text[first_brace:last_brace + 1]
        
        # Estrategia 3: Retornar texto completo (fallará en json.loads)
        return text.strip()

"""Cliente de Google Gemini."""

import time
from typing import Literal

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ai.base import (
    AIImage,
    AIProvider,
    AIProviderError,
    AIResponse,
    ContentPolicyError,
    InvalidResponseError,
    RateLimitError,
)

logger = get_logger(__name__)


# Costos por 1M tokens (Gemini 2.0 Flash, actualizado julio 2026)
GEMINI_COSTS = {
    "input_per_million": 0.075,
    "output_per_million": 0.30,
}


class GeminiClient(AIProvider):
    """Cliente de Google Gemini 2.0 Flash."""
    
    def __init__(self):
        if not settings.gemini_api_key:
            raise AIProviderError(
                "Gemini API key no configurada",
                provider="gemini",
                retryable=False,
            )
        
        genai.configure(api_key=settings.gemini_api_key)
        
        # Configurar modelo con safety settings permisivos para análisis beauty
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            safety_settings=safety_settings,
        )
    
    @property
    def name(self) -> Literal["gemini", "claude"]:
        return "gemini"
    
    async def generate_multimodal(
        self,
        prompt: str,
        images: list[AIImage],
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AIResponse:
        """Genera respuesta multimodal con Gemini."""
        start_time = time.time()
        
        try:
            content = [prompt]
            for img in images:
                content.append({
                    "mime_type": img.mime_type,
                    "data": img.data,
                })
            
            import asyncio
            loop = asyncio.get_event_loop()
            
            response = await loop.run_in_executor(
                None,
                lambda: self.model.generate_content(
                    content,
                    generation_config=genai.GenerationConfig(
                        max_output_tokens=max_tokens,
                        temperature=temperature,
                        response_mime_type="application/json",
                    ),
                ),
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Verificar bloqueos de seguridad
            if hasattr(response, "prompt_feedback") and response.prompt_feedback.block_reason:
                raise ContentPolicyError(
                    f"Contenido bloqueado: {response.prompt_feedback.block_reason}",
                    provider="gemini",
                )
            
            try:
                text = response.text
            except ValueError as e:
                raise InvalidResponseError(
                    f"No se pudo extraer texto: {e}",
                    provider="gemini",
                )
            
            # Estimar tokens
            tokens_input = sum(len(img.data) // 4 for img in images) + len(prompt) // 4
            tokens_output = len(text) // 3
            
            cost_usd = (
                (tokens_input / 1_000_000) * GEMINI_COSTS["input_per_million"]
                + (tokens_output / 1_000_000) * GEMINI_COSTS["output_per_million"]
            )
            
            finish_reason = "stop"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason = response.candidates[0].finish_reason.name
            
            logger.info(
                "gemini_response_received",
                latency_ms=latency_ms,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost_usd=round(cost_usd, 6),
                finish_reason=finish_reason,
            )
            
            return AIResponse(
                content=text,
                provider="gemini",
                model="gemini-2.0-flash",
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                finish_reason=finish_reason,
                raw_response={"candidates": len(response.candidates)} if response.candidates else {},
            )
        
        except google_exceptions.ResourceExhausted as e:
            raise RateLimitError(
                f"Gemini rate limit excedido: {e}",
                provider="gemini",
            )
        
        except google_exceptions.ServiceUnavailable as e:
            raise AIProviderError(
                f"Gemini servicio no disponible: {e}",
                provider="gemini",
                retryable=True,
            )
        
        except (ContentPolicyError, InvalidResponseError):
            raise
        
        except Exception as e:
            logger.error("gemini_unexpected_error", error=str(e), exc_info=True)
            raise AIProviderError(
                f"Error inesperado de Gemini: {e}",
                provider="gemini",
                retryable=True,
            )
    
    async def health_check(self) -> bool:
        """Verifica que Gemini está operativo."""
        try:
            response = self.model.generate_content("Hola")
            return bool(response.text)
        except Exception as e:
            logger.warning("gemini_health_check_failed", error=str(e))
            return False

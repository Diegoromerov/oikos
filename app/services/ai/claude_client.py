"""Cliente de Anthropic Claude (fallback)."""

import asyncio
import base64
import time
from typing import Literal

import anthropic

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


# Costos por 1M tokens (Claude 3.5 Sonnet, actualizado julio 2026)
CLAUDE_COSTS = {
    "input_per_million": 3.0,
    "output_per_million": 15.0,
}


class ClaudeClient(AIProvider):
    """Cliente de Anthropic Claude 3.5 Sonnet (fallback de Gemini)."""
    
    def __init__(self):
        if not settings.claude_api_key:
            raise AIProviderError(
                "Claude API key no configurada",
                provider="claude",
                retryable=False,
            )
        
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.claude_api_key,
            timeout=settings.ai_timeout_seconds,
        )
    
    @property
    def name(self) -> Literal["gemini", "claude"]:
        return "claude"
    
    async def generate_multimodal(
        self,
        prompt: str,
        images: list[AIImage],
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AIResponse:
        """Genera respuesta multimodal con Claude."""
        start_time = time.time()
        
        try:
            content = []
            
            # Agregar imágenes
            for img in images:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img.mime_type,
                        "data": base64.standard_b64encode(img.data).decode("utf-8"),
                    },
                })
            
            # Agregar prompt de texto
            content.append({
                "type": "text",
                "text": prompt,
            })
            
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20250514",
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": content}],
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            if response.stop_reason == "end_turn":
                finish_reason = "stop"
            elif response.stop_reason == "max_tokens":
                finish_reason = "max_tokens"
            else:
                finish_reason = response.stop_reason or "unknown"
            
            text = ""
            for block in response.content:
                if block.type == "text":
                    text += block.text
            
            if not text:
                raise InvalidResponseError(
                    "Claude no retornó texto en la respuesta",
                    provider="claude",
                )
            
            tokens_input = response.usage.input_tokens
            tokens_output = response.usage.output_tokens
            
            cost_usd = (
                (tokens_input / 1_000_000) * CLAUDE_COSTS["input_per_million"]
                + (tokens_output / 1_000_000) * CLAUDE_COSTS["output_per_million"]
            )
            
            logger.info(
                "claude_response_received",
                latency_ms=latency_ms,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost_usd=round(cost_usd, 6),
                finish_reason=finish_reason,
            )
            
            return AIResponse(
                content=text,
                provider="claude",
                model="claude-3-5-sonnet-20250514",
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                finish_reason=finish_reason,
                raw_response={"stop_reason": response.stop_reason, "id": response.id},
            )
        
        except anthropic.RateLimitError as e:
            raise RateLimitError(
                f"Claude rate limit excedido: {e}",
                provider="claude",
            )
        
        except anthropic.APIStatusError as e:
            if e.status_code == 400 and "content_policy" in str(e).lower():
                raise ContentPolicyError(
                    f"Claude bloqueó contenido: {e}",
                    provider="claude",
                )
            raise AIProviderError(
                f"Error de API de Claude: {e}",
                provider="claude",
                retryable=e.status_code >= 500,
            )
        
        except (ContentPolicyError, InvalidResponseError):
            raise
        
        except Exception as e:
            logger.error("claude_unexpected_error", error=str(e), exc_info=True)
            raise AIProviderError(
                f"Error inesperado de Claude: {e}",
                provider="claude",
                retryable=True,
            )
    
    async def health_check(self) -> bool:
        """Verifica que Claude está operativo."""
        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20250514",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hola"}],
            )
            return bool(response.content)
        except Exception as e:
            logger.warning("claude_health_check_failed", error=str(e))
            return False

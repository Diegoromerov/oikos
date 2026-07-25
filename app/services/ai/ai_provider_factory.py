"""Factory de proveedores de IA con fallback automático."""

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ai.base import (
    AIImage,
    AIProvider,
    AIProviderError,
    AIResponse,
    ContentPolicyError,
    RateLimitError,
)
from app.services.ai.claude_client import ClaudeClient
from app.services.ai.gemini_client import GeminiClient

logger = get_logger(__name__)


class AIProviderFactory:
    """
    Factory que gestiona proveedores de IA con fallback automático.
    
    Flujo:
    1. Intenta con proveedor primario (configurado en settings)
    2. Si falla con error retryable, reintenta hasta 3 veces
    3. Si sigue fallando, hace fallback al proveedor secundario
    4. Si ambos fallan, lanza excepción
    """
    
    def __init__(self):
        self._primary_provider: AIProvider | None = None
        self._fallback_provider: AIProvider | None = None
        self._initialized = False
    
    def _initialize(self) -> None:
        """Inicializa proveedores lazy (solo cuando se necesitan)."""
        if self._initialized:
            return
        
        if settings.ai_primary_provider == "gemini":
            try:
                self._primary_provider = GeminiClient()
                logger.info("ai_primary_initialized", provider="gemini")
            except AIProviderError as e:
                logger.warning("gemini_init_failed", error=str(e))
            
            try:
                self._fallback_provider = ClaudeClient()
                logger.info("ai_fallback_initialized", provider="claude")
            except AIProviderError as e:
                logger.warning("claude_init_failed", error=str(e))
        
        else:  # claude es primario
            try:
                self._primary_provider = ClaudeClient()
                logger.info("ai_primary_initialized", provider="claude")
            except AIProviderError as e:
                logger.warning("claude_init_failed", error=str(e))
            
            try:
                self._fallback_provider = GeminiClient()
                logger.info("ai_fallback_initialized", provider="gemini")
            except AIProviderError as e:
                logger.warning("gemini_init_failed", error=str(e))
        
        if not self._primary_provider and not self._fallback_provider:
            raise AIProviderError(
                "Ningún proveedor de IA disponible. Configura GEMINI_API_KEY o CLAUDE_API_KEY",
                provider="none",
                retryable=False,
            )
        
        self._initialized = True
    
    @retry(
        retry=retry_if_exception_type((RateLimitError, AIProviderError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def _call_with_retry(
        self,
        provider: AIProvider,
        prompt: str,
        images: list[AIImage],
        max_tokens: int,
        temperature: float,
    ) -> AIResponse:
        """Llama a un proveedor con retry automático."""
        return await provider.generate_multimodal(
            prompt=prompt,
            images=images,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    
    async def generate(
        self,
        prompt: str,
        images: list[AIImage],
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AIResponse:
        """
        Genera respuesta con fallback automático entre proveedores.
        """
        self._initialize()
        
        # Intentar con proveedor primario
        if self._primary_provider:
            try:
                response = await self._call_with_retry(
                    provider=self._primary_provider,
                    prompt=prompt,
                    images=images,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                return response
            
            except ContentPolicyError:
                logger.warning("content_policy_blocked", provider=self._primary_provider.name)
                raise
            
            except AIProviderError as e:
                logger.warning(
                    "primary_provider_failed",
                    provider=self._primary_provider.name,
                    error=str(e),
                    retryable=e.retryable,
                )
                
                if not e.retryable:
                    raise
        
        # Fallback al proveedor secundario
        if self._fallback_provider:
            logger.info(
                "falling_back_to_secondary",
                from_provider=self._primary_provider.name if self._primary_provider else "none",
                to_provider=self._fallback_provider.name,
            )
            
            try:
                response = await self._call_with_retry(
                    provider=self._fallback_provider,
                    prompt=prompt,
                    images=images,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                return response
            
            except ContentPolicyError:
                logger.warning("content_policy_blocked_fallback", provider=self._fallback_provider.name)
                raise
            
            except AIProviderError as e:
                logger.error(
                    "fallback_provider_also_failed",
                    provider=self._fallback_provider.name,
                    error=str(e),
                )
                raise
        
        raise AIProviderError(
            "Todos los proveedores de IA fallaron o no están disponibles",
            provider="all",
            retryable=False,
        )
    
    async def health_check(self) -> dict[str, bool]:
        """Verifica estado de todos los proveedores."""
        self._initialize()
        
        status = {}
        if self._primary_provider:
            status[f"{self._primary_provider.name}_primary"] = await self._primary_provider.health_check()
        if self._fallback_provider:
            status[f"{self._fallback_provider.name}_fallback"] = await self._fallback_provider.health_check()
        
        return status


_ai_factory: AIProviderFactory | None = None


def get_ai_provider() -> AIProviderFactory:
    """Retorna la instancia singleton del factory."""
    global _ai_factory
    if _ai_factory is None:
        _ai_factory = AIProviderFactory()
    return _ai_factory

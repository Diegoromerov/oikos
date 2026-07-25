"""Clase base abstracta para proveedores de IA."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


@dataclass
class AIImage:
    """Imagen para enviar al modelo de IA."""
    
    data: bytes  # Bytes crudos de la imagen
    mime_type: str  # "image/jpeg", "image/png"
    name: str  # "face_frontal", "face_lateral", "hair", "hand"


@dataclass
class AIResponse:
    """Respuesta estandarizada de cualquier proveedor de IA."""
    
    content: str  # Texto crudo de la respuesta
    provider: Literal["gemini", "claude"]
    model: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    latency_ms: int
    finish_reason: str  # "stop", "max_tokens", "error"
    raw_response: dict  # Respuesta completa del proveedor (para debugging)


class AIProviderError(Exception):
    """Error base de proveedor de IA."""
    
    def __init__(
        self,
        message: str,
        provider: str,
        retryable: bool = True,
    ):
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable


class RateLimitError(AIProviderError):
    """Error de rate limit."""
    
    def __init__(self, message: str, provider: str):
        super().__init__(message, provider=provider, retryable=True)


class ContentPolicyError(AIProviderError):
    """Error de política de contenido."""
    
    def __init__(self, message: str, provider: str):
        super().__init__(message, provider=provider, retryable=False)


class InvalidResponseError(AIProviderError):
    """Respuesta inválida del modelo."""
    
    def __init__(self, message: str, provider: str):
        super().__init__(message, provider=provider, retryable=False)


class AIProvider(ABC):
    """Interfaz abstracta para proveedores de IA."""
    
    @property
    @abstractmethod
    def name(self) -> Literal["gemini", "claude"]:
        """Nombre del proveedor."""
        pass
    
    @abstractmethod
    async def generate_multimodal(
        self,
        prompt: str,
        images: list[AIImage],
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AIResponse:
        """
        Genera respuesta multimodal (texto + imágenes).
        
        Args:
            prompt: Texto del prompt
            images: Lista de imágenes (máximo 4 para este caso)
            max_tokens: Máximo de tokens en respuesta
            temperature: Temperatura del modelo (0.0 a 1.0)
        
        Returns:
            AIResponse estandarizada
        
        Raises:
            AIProviderError: Si falla la llamada
            RateLimitError: Si se excede rate limit
            ContentPolicyError: Si viola política de contenido
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Verifica que el proveedor está operativo."""
        pass

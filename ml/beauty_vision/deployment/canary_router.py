"""
Router canary entre Gemini/Claude y modelo propietario.
"""

import os
import random
from typing import Optional
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.core.redis import get_redis
from app.ml.beauty_vision.inference.predictor import BeautyVisionPredictor
from app.schemas.ai.analysis_result import AIBeautyAnalysisResult

logger = get_logger(__name__)


class CanaryRouter:
    """Router canary entre modelos."""
    
    def __init__(self):
        try:
            self.redis = get_redis()
        except RuntimeError:
            self.redis = None
            
        # Parámetros desde config o env
        self.beauty_vision_enabled = getattr(settings, 'beauty_vision_enabled', False) or os.getenv('BEAUTY_VISION_ENABLED') == 'true'
        self.model_path = getattr(settings, 'beauty_vision_model_path', 'best_model.pt')
        self.device = getattr(settings, 'beauty_vision_device', 'cpu')
        
        self.predictor = None
        if self.beauty_vision_enabled:
            self.predictor = BeautyVisionPredictor(
                model_path=self.model_path,
                device=self.device,
            )
    
    async def route(
        self,
        prompt: str,
        images: dict[str, bytes],
        user_id: Optional[UUID] = None,
    ) -> tuple[Optional[AIBeautyAnalysisResult], str]:
        """Routea request al modelo apropiado."""
        canary_percentage = await self._get_canary_percentage()
        use_own_model = random.random() * 100 < canary_percentage
        
        if use_own_model and self.predictor:
            result, confidence = await self.predictor.predict(images, user_id)
            if result is not None:
                logger.info("routed_to_own_model", confidence=confidence)
                return result, 'beauty-vision-1'
        
        return None, 'external-fallback'
        
    async def _get_canary_percentage(self) -> float:
        if not self.redis:
            return 5.0
        try:
            value = await self.redis.get('canary:beauty-vision:percentage')
            return float(value) if value else 5.0
        except Exception:
            return 5.0
            
    async def set_canary_percentage(self, percentage: float) -> None:
        if not self.redis:
            return
        if not 0 <= percentage <= 100:
            raise ValueError("Percentage must be 0-100")
        await self.redis.set('canary:beauty-vision:percentage', str(percentage))

"""Schemas de Pydantic para el módulo de IA."""

from app.schemas.ai.analysis_request import BeautyScanRequest
from app.schemas.ai.analysis_result import (
    AIBeautyAnalysisResult,
    BrowVisajismoResult,
    HairDiagnosisResult,
    HandMorphologyResult,
    OrchestratorMetadata,
    RecommendedProduct,
    RecommendedService,
    SkinConcernResult,
)
from app.schemas.ai.prompt_context import PromptContext

__all__ = [
    "BeautyScanRequest",
    "AIBeautyAnalysisResult",
    "BrowVisajismoResult",
    "HairDiagnosisResult",
    "HandMorphologyResult",
    "OrchestratorMetadata",
    "RecommendedProduct",
    "RecommendedService",
    "SkinConcernResult",
    "PromptContext",
]

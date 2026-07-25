"""Exportar todos los schemas."""

from app.schemas.user import UserBase, UserCreate, UserUpdate, UserResponse
from app.schemas.beauty_profile import (
    BeautyProfileResponse,
    SkinConcern,
    HairDiagnosis,
    HandMorphology,
    BrowVisajismo,
    TrendAffinity,
    EvolutionSnapshot,
)
from app.schemas.biometric_consent import (
    BiometricConsentCreate,
    BiometricConsentResponse,
)
from app.schemas.beauty_scan_session import (
    BeautyScanSessionCreate,
    BeautyScanSessionUpdate,
    BeautyScanSessionResponse,
)
from app.schemas.tiktok_hashtag_trend import (
    TikTokHashtagTrendCreate,
    TikTokHashtagTrendResponse,
)

__all__ = [
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "BeautyProfileResponse",
    "SkinConcern",
    "HairDiagnosis",
    "HandMorphology",
    "BrowVisajismo",
    "TrendAffinity",
    "EvolutionSnapshot",
    "BiometricConsentCreate",
    "BiometricConsentResponse",
    "BeautyScanSessionCreate",
    "BeautyScanSessionUpdate",
    "BeautyScanSessionResponse",
    "TikTokHashtagTrendCreate",
    "TikTokHashtagTrendResponse",
]

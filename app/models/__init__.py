"""Exportar todos los modelos para que Alembic los detecte."""

from app.models.user import User
from app.models.beauty_profile import BeautyProfile
from app.models.biometric_consent import BiometricConsent
from app.models.beauty_scan_session import BeautyScanSession
from app.models.evolution_snapshot import EvolutionSnapshot
from app.models.tiktok_hashtag_trend import TikTokHashtagTrend
from app.models.color_dna import ColorDNA
from app.models.color_recommendation import ColorRecommendation, ColorTryOnHistory
from app.models.affiliate import Affiliate
from app.models.affiliate_commission import AffiliateCommission
from app.models.hair_health import HairHealthReport, HairTreatmentPlan

__all__ = [
    "User",
    "BeautyProfile",
    "BiometricConsent",
    "BeautyScanSession",
    "EvolutionSnapshot",
    "TikTokHashtagTrend",
    "ColorDNA",
    "ColorRecommendation",
    "ColorTryOnHistory",
    "Affiliate",
    "AffiliateCommission",
    "HairHealthReport",
    "HairTreatmentPlan",
]

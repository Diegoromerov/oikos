"""Orquestador principal del Beauty Intelligence Engine."""

import time
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.beauty_profile import BeautyProfile
from app.models.beauty_scan_session import BeautyScanSession
from app.models.evolution_snapshot import EvolutionSnapshot
from app.models.tiktok_hashtag_trend import TikTokHashtagTrend
from app.schemas.ai.analysis_request import BeautyScanRequest
from app.schemas.ai.analysis_result import (
    AIBeautyAnalysisResult,
    OrchestratorMetadata,
)
from app.schemas.ai.prompt_context import PromptContext
from app.schemas.beauty_profile import BeautyProfileResponse
from app.schemas.tiktok_hashtag_trend import TikTokHashtagTrendResponse
from app.services.ai import AIImage, get_ai_provider
from app.services.ai.base import AIResponse
from app.services.prompt_builder import PromptBuilder
from app.services.response_parser import ResponseParser

logger = get_logger(__name__)


class BeautyOrchestrator:
    """
    Orquestador central del Beauty Intelligence Engine.
    
    Responsabilidades:
    1. Recibir 4 imágenes del usuario
    2. Construir contexto (perfil existente + tendencias)
    3. Construir prompt multimodal
    4. Llamar a IA (con fallback)
    5. Parsear respuesta
    6. Actualizar beauty_profile
    7. Actualizar beauty_scan_session
    8. Retornar resultado completo
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_provider = get_ai_provider()
        self.prompt_builder = PromptBuilder()
        self.response_parser = ResponseParser()
    
    async def process_scan(
        self,
        user_id: UUID,
        images: dict[str, bytes],
        scan_session_id: UUID,
    ) -> tuple[AIBeautyAnalysisResult, OrchestratorMetadata]:
        """
        Procesa un escaneo beauty completo.
        
        Args:
            user_id: ID del usuario
            images: Dict con 4 imágenes {"face_frontal": bytes, "face_lateral": bytes, "hair": bytes, "hand": bytes}
            scan_session_id: ID de la sesión de escaneo
        
        Returns:
            Tupla (análisis, metadata)
        
        Raises:
            ValueError: Si faltan imágenes o consentimiento
            AIProviderError: Si falla la llamada a IA
        """
        start_time = time.time()
        retry_count = 0
        fallback_used = False
        
        # ── Paso 1: Validar imágenes ──────────────────────────────────
        self._validate_images(images)
        
        # ── Paso 2: Construir contexto ────────────────────────────────
        context = await self._build_context(user_id)
        
        # ── Paso 3: Construir prompt ──────────────────────────────────
        prompt = self.prompt_builder.build(context)
        # ── Paso 4: Preparar imágenes para IA (Dinámico basado en consentimiento) ──
        ai_images = [
            AIImage(data=data, mime_type="image/jpeg", name=key)
            for key, data in images.items() if data
        ]
        # ── Paso 5: Llamar a IA ───────────────────────────────────────
        logger.info(
            "orchestrator_calling_ai",
            user_id=str(user_id),
            scan_number=context.scan_number,
            has_existing_profile=context.existing_profile is not None,
        )
        
        ai_response: AIResponse = await self.ai_provider.generate(
            prompt=prompt,
            images=ai_images,
            max_tokens=4096,
            temperature=0.3,
        )
        
        # Detectar si se usó fallback
        primary_provider = "gemini"
        fallback_used = ai_response.provider != primary_provider
        
        # ── Paso 6: Parsear respuesta ─────────────────────────────────
        analysis_result = self.response_parser.parse(
            raw_response=ai_response.content,
            provider=ai_response.provider,
        )
        
        # ── Paso 7: Calcular trend affinity ───────────────────────────
        analysis_result.matched_trending_hashtags = self._calculate_trend_affinity(
            analysis=analysis_result,
            trends=context.trending_hashtags,
        )
        
        # ── Paso 8: Actualizar beauty_profile ─────────────────────────
        profile = await self._update_beauty_profile(
            user_id=user_id,
            analysis=analysis_result,
        )
        
        # ── Paso 9: Actualizar scan_session ───────────────────────────
        processing_time = time.time() - start_time
        
        metadata = OrchestratorMetadata(
            ai_provider=ai_response.provider,
            ai_model=ai_response.model,
            tokens_input=ai_response.tokens_input,
            tokens_output=ai_response.tokens_output,
            cost_usd=ai_response.cost_usd,
            processing_time_seconds=processing_time,
            retry_count=retry_count,
            fallback_used=fallback_used,
        )
        
        await self._update_scan_session(
            session_id=scan_session_id,
            profile_id=profile.id,
            analysis=analysis_result,
            metadata=metadata,
        )
        
        logger.info(
            "orchestrator_scan_completed",
            user_id=str(user_id),
            beauty_score=analysis_result.beauty_score,
            provider=ai_response.provider,
            cost_usd=round(ai_response.cost_usd, 6),
            latency_ms=ai_response.latency_ms,
            total_time_seconds=round(processing_time, 2),
        )
        
        return analysis_result, metadata

    def _validate_images(self, images: dict[str, bytes]) -> None:
        """Valida que haya al menos una imagen autorizada y con contenido."""
        if not images or not any(images.values()):
            raise ValueError("No se recibió ninguna imagen válida para el diagnóstico biométrico.")
            
    async def _build_context(self, user_id: UUID) -> PromptContext:
        """Construye el contexto completo para el prompt."""
        # 1. Obtener perfil existente
        stmt = select(BeautyProfile).where(BeautyProfile.user_id == user_id)
        result = await self.db.execute(stmt)
        profile_orm = result.scalar_one_or_none()
        
        existing_profile = None
        if profile_orm:
            existing_profile = BeautyProfileResponse.model_validate(profile_orm)
            
        # 2. Obtener tendencias top 10
        trends_stmt = select(TikTokHashtagTrend).order_by(
            TikTokHashtagTrend.growth_percentage.desc()
        ).limit(10)
        trends_result = await self.db.execute(trends_stmt)
        trending_hashtags = [
            TikTokHashtagTrendResponse.model_validate(t)
            for t in trends_result.scalars().all()
        ]
        
        # 3. Calcular número de escaneo
        count_stmt = select(func.count(BeautyScanSession.id)).where(
            BeautyScanSession.user_id == user_id,
            BeautyScanSession.status == "completed"
        )
        count_result = await self.db.execute(count_stmt)
        scan_number = (count_result.scalar() or 0) + 1
        
        return PromptContext(
            existing_profile=existing_profile,
            trending_hashtags=trending_hashtags,
            scan_number=scan_number,
        )
        
    def _calculate_trend_affinity(
        self,
        analysis: AIBeautyAnalysisResult,
        trends: list[TikTokHashtagTrendResponse]
    ) -> list[str]:
        """Asocia hashtags trending al análisis del usuario."""
        matched = []
        # Normalizar ingredientes y preocupaciones recomendadas
        recommended_ingredients = []
        for p in analysis.recommended_products:
            recommended_ingredients.extend([ing.lower().strip() for ing in p.key_ingredients])
            
        concerns = [c.type.lower() for c in analysis.skin_concerns]
        
        for t in trends:
            hashtag_clean = t.hashtag.lower().replace("#", "").strip()
            # 1. Match ingrediente
            if any(ing in hashtag_clean for ing in recommended_ingredients):
                matched.append(t.hashtag)
                continue
            # 2. Match preocupaciones
            if any(con in hashtag_clean for con in concerns):
                matched.append(t.hashtag)
                continue
            # 3. Match de rutina/comercial general
            if t.category in ["rutina_cuidado", "glow_estetica"] and len(matched) < 3:
                matched.append(t.hashtag)
                
        return list(set(matched))
        
    async def _update_beauty_profile(
        self,
        user_id: UUID,
        analysis: AIBeautyAnalysisResult
    ) -> BeautyProfile:
        """Crea o actualiza el perfil beauty y añade evolución."""
        stmt = select(BeautyProfile).where(BeautyProfile.user_id == user_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()
        
        # Mapear schemas a formato dict compatible con JSONB
        skin_concerns_db = [
            {
                "type": c.type,
                "severity": c.severity,
                "detected_at": datetime.utcnow().isoformat(),
                "confidence": c.confidence
            }
            for c in analysis.skin_concerns
        ]
        
        hair_diag_db = {
            "porosity": analysis.hair_diagnosis.porosity,
            "damage_level": analysis.hair_diagnosis.damage_level,
            "hair_type": analysis.hair_diagnosis.hair_type,
            "density": analysis.hair_diagnosis.density,
            "detected_at": datetime.utcnow().isoformat()
        }
        
        hand_morph_db = {
            "hand_shape": analysis.hand_morphology.hand_shape,
            "finger_length": analysis.hand_morphology.finger_length,
            "recommended_nail_shape": analysis.hand_morphology.recommended_nail_shape,
            "detected_at": datetime.utcnow().isoformat()
        }
        
        brow_vis_db = {
            "face_shape": analysis.brow_visajismo.face_shape,
            "ideal_brow_start": analysis.brow_visajismo.ideal_brow_start,
            "ideal_brow_arch": analysis.brow_visajismo.ideal_brow_arch,
            "ideal_brow_end": analysis.brow_visajismo.ideal_brow_end,
            "symmetry_score": analysis.brow_visajismo.symmetry_score,
            "detected_at": datetime.utcnow().isoformat()
        }
        
        # Generar trend affinity
        trend_aff_db = [
            {
                "category": "ingredientes_activos",
                "trending_hashtags": analysis.matched_trending_hashtags,
                "match_score": 0.85 if analysis.matched_trending_hashtags else 0.0,
                "updated_at": datetime.utcnow().isoformat()
            }
        ]
        
        snapshot = {
            "scan_date": datetime.utcnow().isoformat(),
            "beauty_score": analysis.beauty_score,
            "skin_concerns_count": len(analysis.skin_concerns),
            "hair_damage_level": analysis.hair_diagnosis.damage_level,
            "improvements": ["Actualización de perfil"]
        }
        
        if not profile:
            profile = BeautyProfile(
                user_id=user_id,
                skin_subtone=analysis.skin_subtone,
                skin_subtone_confidence=analysis.skin_subtone_confidence,
                skin_concerns=skin_concerns_db,
                hair_diagnosis=hair_diag_db,
                hand_morphology=hand_morph_db,
                brow_visajismo=brow_vis_db,
                trend_affinity=trend_aff_db,
                beauty_score=analysis.beauty_score,
                evolution_history=[snapshot],
            )
            self.db.add(profile)
        else:
            profile.skin_subtone = analysis.skin_subtone
            profile.skin_subtone_confidence = analysis.skin_subtone_confidence
            profile.skin_concerns = skin_concerns_db
            profile.hair_diagnosis = hair_diag_db
            profile.hand_morphology = hand_morph_db
            profile.brow_visajismo = brow_vis_db
            profile.trend_affinity = trend_aff_db
            profile.beauty_score = analysis.beauty_score
            
            history = list(profile.evolution_history or [])
            history.append(snapshot)
            profile.evolution_history = history
            
        await self.db.flush()
        
        # Guardar en evolution_snapshots
        evo_snap = EvolutionSnapshot(
            beauty_profile_id=profile.id,
            snapshot_date=datetime.utcnow(),
            beauty_score=analysis.beauty_score,
            skin_concerns_count=len(analysis.skin_concerns),
            hair_damage_level=analysis.hair_diagnosis.damage_level,
            improvements={"list": ["Actualización de perfil"]},
            full_snapshot=analysis.model_dump(),
        )
        self.db.add(evo_snap)
        await self.db.flush()
        
        return profile
        
    async def _update_scan_session(
        self,
        session_id: UUID,
        profile_id: UUID,
        analysis: AIBeautyAnalysisResult,
        metadata: OrchestratorMetadata
    ) -> None:
        """Actualiza el estado de la sesión de escaneo."""
        stmt = select(BeautyScanSession).where(BeautyScanSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        
        if session:
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            session.beauty_profile_id = profile_id
            session.processing_metadata = metadata.model_dump()
            await self.db.flush()

"""Tests del BeautyOrchestrator."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.user import User
from app.models.beauty_profile import BeautyProfile
from app.models.beauty_scan_session import BeautyScanSession
from app.services.beauty_orchestrator import BeautyOrchestrator
from app.tests.mocks.gemini_responses import VALID_RESPONSE


@pytest.fixture
async def test_user(db_session):
    """Crea usuario de prueba."""
    user = User(
        email="orchestrator_test@example.com",
        hashed_password="hashed123",
        full_name="Orchestrator Test",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_scan_session(db_session, test_user):
    """Crea sesión de escaneo de prueba."""
    import datetime
    session = BeautyScanSession(
        user_id=test_user.id,
        session_number=1,
        started_at=datetime.datetime.utcnow(),
        status="processing",
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest.fixture
def sample_images_dict():
    """Imágenes de prueba (bytes fake)."""
    return {
        "face_frontal": b"fake_face_frontal_data",
        "face_lateral": b"fake_face_lateral_data",
        "hair": b"fake_hair_data",
        "hand": b"fake_hand_data",
    }


@pytest.mark.asyncio
async def test_orchestrator_process_scan_success(
    db_session, test_user, test_scan_session, sample_images_dict
):
    """Test procesamiento exitoso de escaneo."""
    
    with patch("app.services.beauty_orchestrator.get_ai_provider") as mock_get_provider:
        # Mock del proveedor de IA
        mock_provider = AsyncMock()
        mock_ai_response = MagicMock()
        mock_ai_response.content = VALID_RESPONSE
        mock_ai_response.provider = "gemini"
        mock_ai_response.model = "gemini-2.0-flash"
        mock_ai_response.tokens_input = 5000
        mock_ai_response.tokens_output = 2000
        mock_ai_response.cost_usd = 0.00165
        mock_ai_response.latency_ms = 3200
        
        mock_provider.generate.return_value = mock_ai_response
        mock_get_provider.return_value = mock_provider
        
        # Ejecutar orquestador
        orchestrator = BeautyOrchestrator(db_session)
        analysis, metadata = await orchestrator.process_scan(
            user_id=test_user.id,
            images=sample_images_dict,
            scan_session_id=test_scan_session.id,
        )
        
        # Validar análisis
        assert analysis.skin_subtone == "warm"
        assert analysis.beauty_score == 78
        assert len(analysis.skin_concerns) == 2
        assert len(analysis.recommended_products) == 2
        
        # Validar metadata
        assert metadata.ai_provider == "gemini"
        assert metadata.cost_usd == 0.00165
        assert metadata.processing_time_seconds > 0
        
        # Validar que se creó beauty_profile
        from sqlalchemy import select
        result = await db_session.execute(
            select(BeautyProfile).where(BeautyProfile.user_id == test_user.id)
        )
        profile = result.scalar_one()
        
        assert profile.skin_subtone == "warm"
        assert profile.beauty_score == 78
        assert len(profile.evolution_history) == 1


@pytest.mark.asyncio
async def test_orchestrator_missing_images(db_session, test_user, test_scan_session):
    """Test que faltan imágenes lanza ValueError."""
    
    with patch("app.services.beauty_orchestrator.get_ai_provider"):
        orchestrator = BeautyOrchestrator(db_session)
        
        incomplete_images = {
            "face_frontal": b"data",
        }
        
        with pytest.raises(ValueError, match="Faltan imágenes"):
            await orchestrator.process_scan(
                user_id=test_user.id,
                images=incomplete_images,
                scan_session_id=test_scan_session.id,
            )


@pytest.mark.asyncio
async def test_orchestrator_updates_existing_profile(
    db_session, test_user, test_scan_session, sample_images_dict
):
    """Test que actualiza perfil existente (no crea nuevo)."""
    
    # Crear perfil existente
    existing_profile = BeautyProfile(
        user_id=test_user.id,
        skin_subtone="cold",
        beauty_score=65,
        evolution_history=[],
    )
    db_session.add(existing_profile)
    await db_session.commit()
    
    with patch("app.services.beauty_orchestrator.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_ai_response = MagicMock()
        mock_ai_response.content = VALID_RESPONSE
        mock_ai_response.provider = "gemini"
        mock_ai_response.model = "gemini-2.0-flash"
        mock_ai_response.tokens_input = 5000
        mock_ai_response.tokens_output = 2000
        mock_ai_response.cost_usd = 0.00165
        mock_ai_response.latency_ms = 3200
        
        mock_provider.generate.return_value = mock_ai_response
        mock_get_provider.return_value = mock_provider
        
        orchestrator = BeautyOrchestrator(db_session)
        await orchestrator.process_scan(
            user_id=test_user.id,
            images=sample_images_dict,
            scan_session_id=test_scan_session.id,
        )
        
        # Validar que se actualizó (no se creó nuevo)
        from sqlalchemy import select, func
        result = await db_session.execute(
            select(func.count()).select_from(BeautyProfile).where(
                BeautyProfile.user_id == test_user.id
            )
        )
        count = result.scalar()
        assert count == 1
        
        # Validar que se actualizó
        result = await db_session.execute(
            select(BeautyProfile).where(BeautyProfile.user_id == test_user.id)
        )
        profile = result.scalar_one()
        assert profile.skin_subtone == "warm"
        assert profile.beauty_score == 78
        assert len(profile.evolution_history) == 1

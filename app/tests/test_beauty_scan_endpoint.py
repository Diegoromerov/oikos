"""Tests del endpoint de beauty scan."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime

from app.models.user import User
from app.models.biometric_consent import BiometricConsent
from app.models.beauty_scan_session import BeautyScanSession
from app.tests.mocks.gemini_responses import VALID_RESPONSE


@pytest.fixture
async def user_with_consent(db_session):
    """Crea usuario con consentimiento activo."""
    user = User(
        email="scan_endpoint@example.com",
        hashed_password="hashed123",
        full_name="Scan Endpoint",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    consent = BiometricConsent(
        user_id=user.id,
        version="1.0",
        consent_type="standard",
        accepted_at=datetime.utcnow(),
        consent_text_hash="abc123",
    )
    db_session.add(consent)
    await db_session.commit()
    
    return user


@pytest.fixture
async def scan_session(db_session, user_with_consent):
    """Crea sesión de escaneo."""
    session = BeautyScanSession(
        user_id=user_with_consent.id,
        session_number=1,
        started_at=datetime.utcnow(),
        status="pending",
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest.mark.asyncio
async def test_beauty_scan_endpoint_success(
    client: AsyncClient, user_with_consent, scan_session
):
    """Test endpoint exitoso."""
    
    with patch("app.api.v1.endpoints.beauty_scan.BeautyOrchestrator") as mock_orch_class:
        # Mock del orquestador
        mock_orchestrator = AsyncMock()
        mock_analysis = MagicMock()
        mock_analysis.model_dump.return_value = {"beauty_score": 78}
        mock_metadata = MagicMock()
        mock_metadata.model_dump.return_value = {"cost_usd": 0.00165}
        
        mock_orchestrator.process_scan.return_value = (mock_analysis, mock_metadata)
        mock_orch_class.return_value = mock_orchestrator
        
        files = {
            "face_frontal": ("face.jpg", b"fake_data", "image/jpeg"),
            "face_lateral": ("lateral.jpg", b"fake_data", "image/jpeg"),
            "hair": ("hair.jpg", b"fake_data", "image/jpeg"),
            "hand": ("hand.jpg", b"fake_data", "image/jpeg"),
        }
        
        response = await client.post(
            f"/api/v1/beauty-scan/process?user_id={user_with_consent.id}&scan_session_id={scan_session.id}",
            files=files,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "analysis" in data
        assert "metadata" in data


@pytest.mark.asyncio
async def test_beauty_scan_endpoint_no_consent(
    client: AsyncClient, db_session
):
    """Test endpoint sin consentimiento retorna 403."""
    
    # Crear usuario SIN consentimiento
    user = User(
        email="no_consent@example.com",
        hashed_password="hashed123",
        full_name="No Consent",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    # Crear sesión
    session = BeautyScanSession(
        user_id=user.id,
        session_number=1,
        started_at=datetime.utcnow(),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    
    files = {
        "face_frontal": ("face.jpg", b"fake_data", "image/jpeg"),
        "face_lateral": ("lateral.jpg", b"fake_data", "image/jpeg"),
        "hair": ("hair.jpg", b"fake_data", "image/jpeg"),
        "hand": ("hand.jpg", b"fake_data", "image/jpeg"),
    }
    
    response = await client.post(
        f"/api/v1/beauty-scan/process?user_id={user.id}&scan_session_id={session.id}",
        files=files,
    )
    
    assert response.status_code == 403
    assert "Consentimiento biométrico requerido" in response.json()["detail"]

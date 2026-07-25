"""Tests de servicios."""

import pytest
from uuid import uuid4

from app.models.user import User
from app.schemas.user import UserCreate
from app.services.user_service import UserService
from app.services.beauty_profile_service import BeautyProfileService
from app.services.biometric_consent_service import BiometricConsentService


@pytest.mark.asyncio
async def test_create_user_service(db_session):
    """Test UserService.create_user."""
    service = UserService(db_session)
    
    user_data = UserCreate(
        email="service_test@example.com",
        password="password123",
        full_name="Service Test",
    )
    
    user = await service.create_user(user_data)
    
    assert user.email == "service_test@example.com"
    assert user.full_name == "Service Test"
    assert user.id is not None


@pytest.mark.asyncio
async def test_get_user_by_email(db_session):
    """Test UserService.get_user_by_email."""
    service = UserService(db_session)
    
    # Crear usuario
    user_data = UserCreate(
        email="get_by_email@example.com",
        password="password123",
        full_name="Get By Email",
    )
    await service.create_user(user_data)
    
    # Buscar por email
    user = await service.get_user_by_email("get_by_email@example.com")
    
    assert user is not None
    assert user.email == "get_by_email@example.com"


@pytest.mark.asyncio
async def test_beauty_profile_service(db_session):
    """Test BeautyProfileService."""
    # Crear usuario
    user = User(
        email="profile_service@example.com",
        hashed_password="hashed123",
        full_name="Profile Service",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    service = BeautyProfileService(db_session)
    
    # Crear perfil
    profile = await service.create_profile(
        user_id=user.id,
        skin_subtone="cold",
        beauty_score=85,
    )
    
    assert profile.skin_subtone == "cold"
    assert profile.beauty_score == 85
    
    # Obtener perfil
    retrieved = await service.get_by_user_id(user.id)
    assert retrieved is not None
    assert retrieved.id == profile.id
    
    # Actualizar perfil
    updated = await service.update_profile(
        user_id=user.id,
        beauty_score=90,
    )
    assert updated.beauty_score == 90


@pytest.mark.asyncio
async def test_biometric_consent_service(db_session):
    """Test BiometricConsentService."""
    from datetime import datetime
    from app.schemas.biometric_consent import BiometricConsentCreate
    
    # Crear usuario
    user = User(
        email="consent_service@example.com",
        hashed_password="hashed123",
        full_name="Consent Service",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    service = BiometricConsentService(db_session)
    
    # Crear consentimiento
    consent_data = BiometricConsentCreate(
        version="1.0",
        consent_type="standard",
        consent_text_hash="abc123",
    )
    consent = await service.create_consent(user.id, consent_data)
    
    assert consent.version == "1.0"
    assert consent.consent_type == "standard"
    
    # Obtener consentimiento activo
    active = await service.get_active_consent(user.id, "standard")
    assert active is not None
    assert active.id == consent.id
    
    # Revocar consentimiento
    success = await service.revoke_consent(consent.id)
    assert success is True
    
    # Verificar que ya no está activo
    active_after_revoke = await service.get_active_consent(user.id, "standard")
    assert active_after_revoke is None

"""Tests de modelos SQLAlchemy."""

import pytest
from sqlalchemy import select

from app.models.user import User
from app.models.beauty_profile import BeautyProfile
from app.models.biometric_consent import BiometricConsent


@pytest.mark.asyncio
async def test_create_user(db_session):
    """Test crear usuario."""
    user = User(
        email="test@example.com",
        hashed_password="hashed123",
        full_name="Test User",
        city="Bogotá",
    )
    db_session.add(user)
    await db_session.commit()
    
    result = await db_session.execute(
        select(User).where(User.email == "test@example.com")
    )
    created_user = result.scalar_one()
    
    assert created_user.email == "test@example.com"
    assert created_user.full_name == "Test User"
    assert created_user.city == "Bogotá"
    assert created_user.is_active is True


@pytest.mark.asyncio
async def test_create_beauty_profile(db_session):
    """Test crear beauty profile."""
    # Crear usuario primero
    user = User(
        email="profile@example.com",
        hashed_password="hashed123",
        full_name="Profile User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    # Crear perfil
    profile = BeautyProfile(
        user_id=user.id,
        skin_subtone="warm",
        skin_subtone_confidence=0.85,
        beauty_score=78,
    )
    db_session.add(profile)
    await db_session.commit()
    
    result = await db_session.execute(
        select(BeautyProfile).where(BeautyProfile.user_id == user.id)
    )
    created_profile = result.scalar_one()
    
    assert created_profile.skin_subtone == "warm"
    assert created_profile.skin_subtone_confidence == 0.85
    assert created_profile.beauty_score == 78


@pytest.mark.asyncio
async def test_create_biometric_consent(db_session):
    """Test crear consentimiento biométrico."""
    from datetime import datetime
    
    user = User(
        email="consent@example.com",
        hashed_password="hashed123",
        full_name="Consent User",
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
    
    result = await db_session.execute(
        select(BiometricConsent).where(BiometricConsent.user_id == user.id)
    )
    created_consent = result.scalar_one()
    
    assert created_consent.version == "1.0"
    assert created_consent.consent_type == "standard"
    assert created_consent.revoked_at is None

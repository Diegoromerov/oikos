"""Tests de unidad e integración para el módulo Color Lab."""

import pytest
from uuid import uuid4
from sqlalchemy import select

from app.models.color_dna import ColorDNA
from app.models.color_recommendation import ColorRecommendation, ColorTryOnHistory
from app.services.harmony_calculator import HarmonyCalculator
from app.services.color_lab_service import ColorLabService
from app.schemas.color_lab import MoodType, LightCondition


def test_harmony_calculator_skin_match():
    # 1. Warm skin with warm tone -> high score + contrast bonus
    bp_warm = {"skin_subtone": "warm", "eye_color": "brown", "hair_diagnosis": {}}
    cd_warm = {"undertone": "warm", "tone_level": 7, "color_value": "copper"}
    score_warm = HarmonyCalculator.calculate(bp_warm, cd_warm)
    assert score_warm.skin_match == 100.0

    # 2. Cold skin with warm tone -> low score
    bp_cold = {"skin_subtone": "cold", "eye_color": "brown", "hair_diagnosis": {}}
    score_cold = HarmonyCalculator.calculate(bp_cold, cd_warm)
    assert score_cold.skin_match == 60.0

    # 3. Neutral skin -> mid-high score
    bp_neutral = {"skin_subtone": "neutral", "eye_color": "brown", "hair_diagnosis": {}}
    score_neutral = HarmonyCalculator.calculate(bp_neutral, cd_warm)
    assert score_neutral.skin_match == 85.0


def test_harmony_calculator_eye_match():
    # Complementary eye color check
    bp_blue_eyes = {"skin_subtone": "warm", "eye_color": "blue_grey", "hair_diagnosis": {}}
    cd_copper = {"undertone": "warm", "tone_level": 7, "color_value": "copper_blonde"}
    score_match = HarmonyCalculator.calculate(bp_blue_eyes, cd_copper)
    assert score_match.eye_match == 90.0

    # Non-complementary eye color check
    bp_brown_eyes = {"skin_subtone": "warm", "eye_color": "brown_hazel", "hair_diagnosis": {}}
    cd_ash = {"undertone": "cold", "tone_level": 7, "color_value": "ash"}
    score_no_match = HarmonyCalculator.calculate(bp_brown_eyes, cd_ash)
    assert score_no_match.eye_match == 70.0


def test_harmony_calculator_trend_match():
    bp = {"skin_subtone": "warm", "eye_color": "brown", "hair_diagnosis": {}}
    cd = {"undertone": "warm", "tone_level": 7, "color_value": "copper", "reference": "7.43"}
    
    # Trend exists with high growth
    trends = {
        "trending_colors": [
            {"hashtag": "7.43", "growth_percentage": 80.0}
        ]
    }
    score_trend = HarmonyCalculator.calculate(bp, cd, trends)
    assert score_trend.trend_match == 90.0

    # Trend does not exist
    score_no_trend = HarmonyCalculator.calculate(bp, cd, None)
    assert score_no_trend.trend_match == 50.0


def test_harmony_calculator_technical_viability():
    cd = {"undertone": "warm", "tone_level": 8}
    
    # Healthy hair, target level close to current level
    bp_healthy = {
        "skin_subtone": "warm",
        "eye_color": "brown",
        "hair_diagnosis": {"damage_level": "low", "porosity": "low", "current_level": 7}
    }
    score_healthy = HarmonyCalculator.calculate(bp_healthy, cd)
    assert score_healthy.technical_viability == 100.0

    # Damaged hair, high porosity, target level far from current level
    bp_damaged = {
        "skin_subtone": "warm",
        "eye_color": "brown",
        "hair_diagnosis": {"damage_level": "high", "porosity": "high", "current_level": 4}
    }
    score_damaged = HarmonyCalculator.calculate(bp_damaged, cd)
    # Penalties: damage (-20), porosity (-15), difference (-25) -> 40.0
    assert score_damaged.technical_viability == 40.0


@pytest.mark.asyncio
async def test_color_lab_service_flow(db_session):
    user_id = uuid4()
    
    # 1. Crear un usuario dummy en base de datos para satisfacer la Foreign Key
    from app.models.user import User
    user = User(
        id=user_id,
        email=f"test_color_lab_{uuid4()}@glowapp.com",
        hashed_password="hashed_pwd_123",
        full_name="Color Lab Tester",
        phone="5551234",
        city="Bogotá",
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    await db_session.flush()

    # 2. Iniciar Servicio
    service = ColorLabService(db_session)
    
    beauty_profile = {
        "skin_subtone": "warm",
        "eye_color": "brown",
        "hair_diagnosis": {
            "porosity": "medium",
            "damage_level": "medium",
            "current_level": 5
        }
    }

    # 3. Generar Color DNA
    color_dna = await service.generate_color_dna(user_id, beauty_profile)
    assert color_dna.user_id == user_id
    assert color_dna.harmonic_palette == "Autumn Warm Gold"
    assert "c3" in color_dna.forbidden_colors

    # 4. Obtener Recomendaciones por Mood
    recs = await service.get_recommendations(user_id, mood=MoodType.EVERYDAY)
    assert len(recs) > 0
    for r in recs:
        assert r.mood == "everyday"
        assert r.harmony_score > 0

    # 5. Guardar Try-On History
    try_on = await service.save_try_on_history(
        user_id=user_id,
        color_id="c1",
        light_condition="natural",
        screenshot_url="https://glowapp.com/try-on/test.png"
    )
    assert try_on.color_id == "c1"
    assert try_on.light_condition == "natural"


@pytest.mark.asyncio
async def test_color_lab_endpoints(client, db_session):
    user_id = UUID = "11111111-1111-1111-1111-111111111111"
    
    # Crear usuario mock
    from app.models.user import User
    user = User(
        id=user_id,
        email="mock_user_color_lab@glowapp.com",
        hashed_password="hashed_pwd_123",
        full_name="Color Lab API Tester",
        phone="5551234",
        city="Bogotá",
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    await db_session.flush()

    # 1. POST /api/v1/color-lab/generate
    response = await client.post(f"/api/v1/color-lab/generate?user_id={user_id}")
    assert response.status_code == 201
    data = response.json()
    assert "color_dna" in data

    # 2. GET /api/v1/color-lab/dna
    response = await client.get(f"/api/v1/color-lab/dna?user_id={user_id}")
    assert response.status_code == 200
    assert response.json()["harmonic_palette"] is not None

    # 3. GET /api/v1/color-lab/recommendations
    response = await client.get(f"/api/v1/color-lab/recommendations?user_id={user_id}&mood=everyday")
    assert response.status_code == 200
    assert len(response.json()) > 0

    # 4. GET /api/v1/color-lab
    response = await client.get(f"/api/v1/color-lab?user_id={user_id}")
    assert response.status_code == 200
    res_data = response.json()
    assert "color_dna" in res_data
    assert "recommendations" in res_data
    assert "harmony_scores" in res_data

    # 5. POST /api/v1/color-lab/try-on/history
    try_on_payload = {
        "color_id": "c1",
        "light_condition": "natural",
        "screenshot_url": "https://glowapp.com/try-on/1.png"
    }
    response = await client.post(
        f"/api/v1/color-lab/try-on/history?user_id={user_id}",
        json=try_on_payload
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Try-on history saved"


@pytest.mark.asyncio
async def test_marketplace_endpoints(client, db_session):
    user_id = "11111111-1111-1111-1111-111111111111"
    
    # 1. GET /api/v1/marketplace/products
    response = await client.get(f"/api/v1/marketplace/products?user_id={user_id}")
    assert response.status_code == 200
    products = response.json()
    assert len(products) > 0
    assert "affinity_score" in products[0]

    # 2. GET /api/v1/marketplace/bundles
    response = await client.get(f"/api/v1/marketplace/bundles?user_id={user_id}")
    assert response.status_code == 200
    bundles = response.json()
    assert len(bundles) > 0
    assert "price" in bundles[0]


@pytest.mark.asyncio
async def test_hair_analyzer_endpoints(client, db_session):
    user_id = "11111111-1111-1111-1111-111111111111"
    
    # Crear usuario mock
    from app.models.user import User
    user = User(
        id=user_id,
        email="mock_user_hair_analyzer@glowapp.com",
        hashed_password="hashed_pwd_123",
        full_name="Hair Analyzer API Tester",
        phone="5551234",
        city="Bogotá",
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    await db_session.flush()

    # 1. POST /api/v1/hair-analyzer/scan
    files = {"file": ("hair.jpg", b"fake_image_bytes_raw_data_content", "image/jpeg")}
    response = await client.post(
        f"/api/v1/hair-analyzer/scan?user_id={user_id}",
        files=files
    )
    assert response.status_code == 201
    res_data = response.json()
    assert "report_id" in res_data
    assert "health_score" in res_data
    assert res_data["health_score"]["moisture_level"] == 40.0

    # 2. GET /api/v1/hair-analyzer/history
    response = await client.get(f"/api/v1/hair-analyzer/history?user_id={user_id}")
    assert response.status_code == 200
    history = response.json()
    assert len(history) > 0
    assert history[0]["moisture_level"] == 40.0



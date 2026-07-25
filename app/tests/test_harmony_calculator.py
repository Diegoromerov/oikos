"""Tests unitarios dedicados para HarmonyCalculator."""

import pytest
from app.services.harmony_calculator import HarmonyCalculator


def test_harmony_calculator_skin_match():
    bp_warm = {"skin_subtone": "warm", "eye_color": "brown", "hair_diagnosis": {}}
    cd_warm = {"undertone": "warm", "tone_level": 7, "color_value": "copper"}
    score_warm = HarmonyCalculator.calculate(bp_warm, cd_warm)
    assert score_warm.skin_match == 100.0

    bp_cold = {"skin_subtone": "cold", "eye_color": "brown", "hair_diagnosis": {}}
    score_cold = HarmonyCalculator.calculate(bp_cold, cd_warm)
    assert score_cold.skin_match == 60.0

    bp_neutral = {"skin_subtone": "neutral", "eye_color": "brown", "hair_diagnosis": {}}
    score_neutral = HarmonyCalculator.calculate(bp_neutral, cd_warm)
    assert score_neutral.skin_match == 85.0


def test_harmony_calculator_eye_match():
    bp_blue_eyes = {"skin_subtone": "warm", "eye_color": "blue_grey", "hair_diagnosis": {}}
    cd_copper = {"undertone": "warm", "tone_level": 7, "color_value": "copper_blonde"}
    score_match = HarmonyCalculator.calculate(bp_blue_eyes, cd_copper)
    assert score_match.eye_match == 90.0

    bp_brown_eyes = {"skin_subtone": "warm", "eye_color": "brown_hazel", "hair_diagnosis": {}}
    cd_ash = {"undertone": "cold", "tone_level": 7, "color_value": "ash"}
    score_no_match = HarmonyCalculator.calculate(bp_brown_eyes, cd_ash)
    assert score_no_match.eye_match == 70.0


def test_harmony_calculator_trend_match():
    bp = {"skin_subtone": "warm", "eye_color": "brown", "hair_diagnosis": {}}
    cd = {"undertone": "warm", "tone_level": 7, "color_value": "copper", "reference": "7.43"}
    
    trends = {
        "trending_colors": [
            {"hashtag": "7.43", "growth_percentage": 80.0}
        ]
    }
    score_trend = HarmonyCalculator.calculate(bp, cd, trends)
    assert score_trend.trend_match == 90.0

    score_no_trend = HarmonyCalculator.calculate(bp, cd, None)
    assert score_no_trend.trend_match == 50.0


def test_harmony_calculator_technical_viability():
    cd = {"undertone": "warm", "tone_level": 8}
    
    bp_healthy = {
        "skin_subtone": "warm",
        "eye_color": "brown",
        "hair_diagnosis": {"damage_level": "low", "porosity": "low", "current_level": 7}
    }
    score_healthy = HarmonyCalculator.calculate(bp_healthy, cd)
    assert score_healthy.technical_viability == 100.0

    bp_damaged = {
        "skin_subtone": "warm",
        "eye_color": "brown",
        "hair_diagnosis": {"damage_level": "high", "porosity": "high", "current_level": 4}
    }
    score_damaged = HarmonyCalculator.calculate(bp_damaged, cd)
    assert score_damaged.technical_viability == 40.0


def test_harmony_calculator_lifestyle_match():
    bp = {"skin_subtone": "warm", "eye_color": "brown", "hair_diagnosis": {}}
    
    # High maintenance
    score_high = HarmonyCalculator.calculate(bp, {"maintenance_level": "high"})
    assert score_high.lifestyle_match == 60.0

    # Medium maintenance
    score_med = HarmonyCalculator.calculate(bp, {"maintenance_level": "medium"})
    assert score_med.lifestyle_match == 80.0

    # Low maintenance
    score_low = HarmonyCalculator.calculate(bp, {"maintenance_level": "low"})
    assert score_low.lifestyle_match == 95.0

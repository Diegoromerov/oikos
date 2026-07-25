"""Tests del constructor de prompts."""

import pytest
from app.services.prompt_builder import PromptBuilder
from app.schemas.ai.prompt_context import PromptContext
from app.schemas.beauty_profile import BeautyProfileResponse
from app.schemas.tiktok_hashtag_trend import TikTokHashtagTrendResponse


def test_prompt_builder_basic():
    """Test construcción básica de prompt sin historial ni tendencias."""
    builder = PromptBuilder()
    context = PromptContext(existing_profile=None, trending_hashtags=[])
    
    prompt = builder.build(context)
    
    assert "# ROL Y CONTEXTO" in prompt
    assert "# IMÁGENES PROPORCIONADAS" in prompt
    assert "Este es el PRIMER escaneo del usuario" in prompt
    assert "# TENDENCIAS ACTUALES" in prompt


def test_prompt_builder_with_trends():
    """Test construcción con tendencias."""
    builder = PromptBuilder()
    trends = [
        TikTokHashtagTrendResponse(
            id="42096dcd-2a9f-4045-8bd0-fa3f0a59d900",
            hashtag="bakuchiol",
            category="ingredientes_activos",
            category_label="Ingredientes",
            volume=100000,
            growth_percentage=50.0,
            is_new=True,
            last_updated="2026-07-06T00:00:00Z",
            country="CO",
            period_days=30,
        )
    ]
    context = PromptContext(existing_profile=None, trending_hashtags=trends)
    
    prompt = builder.build(context)
    assert "#bakuchiol" in prompt
    assert "TENDENCIAS ACTUALES DEL MERCADO (COLOMBIA)" in prompt

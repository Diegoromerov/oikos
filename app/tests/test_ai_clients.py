"""Tests de clientes de IA."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ai.base import AIImage, AIProviderError, RateLimitError
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.claude_client import ClaudeClient
from app.services.ai.ai_provider_factory import AIProviderFactory


@pytest.fixture
def sample_images():
    """Imágenes de prueba."""
    return [
        AIImage(data=b"fake_image_data_1", mime_type="image/jpeg", name="face_frontal"),
        AIImage(data=b"fake_image_data_2", mime_type="image/jpeg", name="hair"),
    ]


@pytest.mark.asyncio
async def test_gemini_client_success(sample_images):
    """Test llamada exitosa a Gemini."""
    with patch("app.services.ai.gemini_client.genai") as mock_genai:
        mock_response = MagicMock()
        mock_response.text = '{"skin_subtone": "warm"}'
        mock_response.prompt_feedback.block_reason = None
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].finish_reason.name = "STOP"
        
        mock_model = MagicMock()
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model
        
        with patch("app.services.ai.gemini_client.settings") as mock_settings:
            mock_settings.gemini_api_key = "test_key"
            
            client = GeminiClient()
            response = await client.generate_multimodal(
                prompt="Test prompt",
                images=sample_images,
            )
            
            assert response.provider == "gemini"
            assert response.content == '{"skin_subtone": "warm"}'
            assert response.cost_usd >= 0


@pytest.mark.asyncio
async def test_claude_client_success(sample_images):
    """Test llamada exitosa a Claude."""
    with patch("app.services.ai.claude_client.anthropic.AsyncAnthropic") as mock_anthropic:
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].type = "text"
        mock_response.content[0].text = '{"skin_subtone": "cold"}'
        mock_response.stop_reason = "end_turn"
        mock_response.usage.input_tokens = 1000
        mock_response.usage.output_tokens = 500
        mock_response.id = "msg_123"
        
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client
        
        with patch("app.services.ai.claude_client.settings") as mock_settings:
            mock_settings.claude_api_key = "test_key"
            mock_settings.ai_timeout_seconds = 30
            
            client = ClaudeClient()
            response = await client.generate_multimodal(
                prompt="Test prompt",
                images=sample_images,
            )
            
            assert response.provider == "claude"
            assert response.content == '{"skin_subtone": "cold"}'
            assert response.tokens_input == 1000
            assert response.tokens_output == 500


@pytest.mark.asyncio
async def test_ai_provider_factory_fallback():
    """Test fallback automático entre proveedores."""
    with patch("app.services.ai.ai_provider_factory.GeminiClient") as mock_gemini, \
         patch("app.services.ai.ai_provider_factory.ClaudeClient") as mock_claude, \
         patch("app.services.ai.ai_provider_factory.settings") as mock_settings:
        
        mock_settings.ai_primary_provider = "gemini"
        
        # Gemini falla
        mock_gemini_instance = AsyncMock()
        mock_gemini_instance.name = "gemini"
        mock_gemini_instance.generate_multimodal.side_effect = AIProviderError(
            "Gemini down", provider="gemini", retryable=True
        )
        mock_gemini.return_value = mock_gemini_instance
        
        # Claude responde
        mock_claude_instance = AsyncMock()
        mock_claude_instance.name = "claude"
        mock_claude_instance.generate_multimodal.return_value = MagicMock(
            provider="claude",
            model="claude-3-5-sonnet",
            content='{"test": "data"}',
            tokens_input=100,
            tokens_output=200,
            cost_usd=0.001,
            latency_ms=1500,
            finish_reason="stop",
            raw_response={},
        )
        mock_claude.return_value = mock_claude_instance
        
        factory = AIProviderFactory()
        response = await factory.generate(
            prompt="Test",
            images=[],
        )
        
        assert response.provider == "claude"

"""Tests del parser de respuestas."""

import pytest

from app.services.response_parser import ResponseParser
from app.services.ai.base import InvalidResponseError
from app.tests.mocks.gemini_responses import (
    VALID_RESPONSE,
    RESPONSE_WITH_MARKDOWN,
    INVALID_JSON,
    MISSING_REQUIRED_FIELDS,
    INVALID_VALUES,
)


@pytest.fixture
def parser():
    return ResponseParser()


def test_parse_valid_response(parser):
    """Test parseo de respuesta válida."""
    result = parser.parse(VALID_RESPONSE, provider="gemini")
    
    assert result.skin_subtone == "warm"
    assert result.skin_subtone_confidence == 0.87
    assert len(result.skin_concerns) == 2
    assert result.skin_concerns[0].type == "dehydration"
    assert result.beauty_score == 78
    assert len(result.recommended_products) == 2


def test_parse_response_with_markdown(parser):
    """Test parseo de respuesta con markdown."""
    result = parser.parse(RESPONSE_WITH_MARKDOWN, provider="gemini")
    
    assert result.skin_subtone == "warm"
    assert result.beauty_score == 78


def test_parse_invalid_json_raises_error(parser):
    """Test que JSON inválido lanza InvalidResponseError."""
    with pytest.raises(InvalidResponseError):
        parser.parse(INVALID_JSON, provider="gemini")


def test_parse_missing_fields_raises_error(parser):
    """Test que campos faltantes lanzan InvalidResponseError."""
    with pytest.raises(InvalidResponseError):
        parser.parse(MISSING_REQUIRED_FIELDS, provider="gemini")


def test_parse_invalid_values_raises_error(parser):
    """Test que valores inválidos lanzan InvalidResponseError."""
    with pytest.raises(InvalidResponseError):
        parser.parse(INVALID_VALUES, provider="gemini")

"""Tests de endpoints de health."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_root(client: AsyncClient) -> None:
    """El health check básico debe retornar 200 con status ok."""
    response = await client.get("/api/v1/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0.0"
    assert "GlowApp" in data["service"]


@pytest.mark.asyncio
async def test_readiness_probe(client: AsyncClient) -> None:
    """Readiness probe debe retornar ready."""
    response = await client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_liveness_probe(client: AsyncClient) -> None:
    """Liveness probe debe retornar alive."""
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

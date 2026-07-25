"""Tests de endpoints API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_user_endpoint(client: AsyncClient):
    """Test POST /api/v1/users/."""
    user_data = {
        "email": "api_test@example.com",
        "password": "password123",
        "full_name": "API Test",
    }
    
    response = await client.post("/api/v1/users/", json=user_data)
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "api_test@example.com"
    assert data["full_name"] == "API Test"
    assert "id" in data


@pytest.mark.asyncio
async def test_get_user_endpoint(client: AsyncClient):
    """Test GET /api/v1/users/{user_id}."""
    # Crear usuario primero
    user_data = {
        "email": "get_api@example.com",
        "password": "password123",
        "full_name": "Get API",
    }
    create_response = await client.post("/api/v1/users/", json=user_data)
    user_id = create_response.json()["id"]
    
    # Obtener usuario
    response = await client.get(f"/api/v1/users/{user_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "get_api@example.com"


@pytest.mark.asyncio
async def test_get_trending_hashtags(client: AsyncClient):
    """Test GET /api/v1/tiktok-trends/."""
    response = await client.get("/api/v1/tiktok-trends/?limit=5")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Puede estar vacío si no hay seed data


@pytest.mark.asyncio
async def test_create_beauty_scan_session(client: AsyncClient):
    """Test POST /api/v1/beauty-scan-sessions/."""
    # Crear usuario primero
    user_data = {
        "email": "scan_session@example.com",
        "password": "password123",
        "full_name": "Scan Session",
    }
    create_response = await client.post("/api/v1/users/", json=user_data)
    user_id = create_response.json()["id"]
    
    # Crear sesión
    response = await client.post(f"/api/v1/beauty-scan-sessions/?user_id={user_id}")
    
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == user_id
    assert data["session_number"] == 1
    assert data["status"] == "pending"

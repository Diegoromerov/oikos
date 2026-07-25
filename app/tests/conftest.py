"""Configuración de pytest para tests async."""

import asyncio
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import Base, get_db
from app.main import app


# Base de datos de prueba
TEST_DATABASE_URL = "postgresql+asyncpg://glowapp:glowapp_dev_2026@localhost:5432/glowapp_test"


@pytest.fixture
async def db_session():
    """Sesión de BD aislada para cada test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    # Sobrescribir el engine y session factory de la aplicación para este test
    import app.core.database
    app.core.database.engine = engine
    app.core.database.async_session_factory = async_session_factory
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session_factory() as session:
        yield session
        
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    """Cliente HTTP async para tests."""
    async def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()

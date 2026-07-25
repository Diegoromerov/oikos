"""Endpoints de API para el Marketplace y Recomendaciones de Productos."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.product_recommender import ProductRecommender

router = APIRouter()

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")


@router.get("/products")
async def get_recommended_products(
    category: Optional[str] = Query(None, description="Filtrar por categoría (skin_care, hair_care, hair_color)"),
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el catálogo de productos ordenado por afinidad con el usuario."""
    recommender = ProductRecommender(db)
    products = await recommender.get_recommended_products(user_id)
    
    if category:
        products = [p for p in products if p["category"] == category]
        
    return products


@router.get("/bundles")
async def get_recommended_bundles(
    user_id: UUID = Query(MOCK_USER_ID),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene paquetes de productos sugeridos con descuento."""
    recommender = ProductRecommender(db)
    bundles = await recommender.get_bundles(user_id)
    return bundles

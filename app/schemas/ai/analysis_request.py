"""Schemas para requests de análisis IA."""

from pydantic import BaseModel, Field


class BeautyScanRequest(BaseModel):
    """Request de escaneo beauty (4 imágenes)."""
    
    user_id: str = Field(..., description="ID del usuario")

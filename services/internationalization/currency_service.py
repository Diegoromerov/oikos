"""
Servicio de conversión de monedas.
"""

from decimal import Decimal
from typing import Optional
from app.core.logging import get_logger
from app.core.redis import get_redis

logger = get_logger(__name__)


class CurrencyService:
    """Servicio de conversión de monedas."""
    
    FALLBACK_RATES = {
        'COP': Decimal('1.0'),
        'MXN': Decimal('230.0'),  # 1 MXN = 230 COP
        'USD': Decimal('4100.0'),  # 1 USD = 4100 COP
    }
    
    def __init__(self):
        try:
            self.redis = get_redis()
        except RuntimeError:
            self.redis = None
    
    async def convert(
        self,
        amount: Decimal,
        from_currency: str,
        to_currency: str,
    ) -> Decimal:
        """Convierte montos entre monedas."""
        if from_currency == to_currency:
            return amount
            
        rate_from = self.FALLBACK_RATES.get(from_currency, Decimal('1.0'))
        rate_to = self.FALLBACK_RATES.get(to_currency, Decimal('1.0'))
        
        # Convertir a base COP primero, luego a to_currency
        amount_in_cop = amount * rate_from
        converted = amount_in_cop / rate_to
        
        return Decimal(str(round(converted, 2)))

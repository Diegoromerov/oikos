"""
Configuración por país para internacionalización LatAm.
"""

from dataclasses import dataclass
from enum import Enum


class Country(str, Enum):
    COLOMBIA = "CO"
    MEXICO = "MX"
    ECUADOR = "EC"


@dataclass
class CountryConfig:
    """Configuración completa de un país."""
    country: Country
    name: str
    currency: str
    currency_symbol: str
    language: str
    timezone: str
    payment_provider: str
    vat_rate: float
    data_protection_law: str
    biometric_consent_required: bool
    default_city: str
    supported_cities: list[str]


COUNTRY_CONFIGS = {
    Country.COLOMBIA: CountryConfig(
        country=Country.COLOMBIA,
        name="Colombia",
        currency="COP",
        currency_symbol="$",
        language="es-CO",
        timezone="America/Bogota",
        payment_provider="wompi",
        vat_rate=0.19,
        data_protection_law="Ley 1581 de 2012",
        biometric_consent_required=True,
        default_city="bogota",
        supported_cities=["bogota", "medellin", "cali", "barranquilla", "bucaramanga"],
    ),
    Country.MEXICO: CountryConfig(
        country=Country.MEXICO,
        name="México",
        currency="MXN",
        currency_symbol="$",
        language="es-MX",
        timezone="America/Mexico_City",
        payment_provider="mercadopago",
        vat_rate=0.16,
        data_protection_law="LFPDPPP",
        biometric_consent_required=True,
        default_city="cdmx",
        supported_cities=["cdmx", "guadalajara", "monterrey"],
    ),
    Country.ECUADOR: CountryConfig(
        country=Country.ECUADOR,
        name="Ecuador",
        currency="USD",
        currency_symbol="$",
        language="es-EC",
        timezone="America/Guayaquil",
        payment_provider="payphone",
        vat_rate=0.15,
        data_protection_law="Ley Orgánica de Protección de Datos Personales",
        biometric_consent_required=True,
        default_city="quito",
        supported_cities=["quito", "guayaquil"],
    ),
}


def get_country_config(country: Country) -> CountryConfig:
    """Obtiene configuración de un país."""
    if country not in COUNTRY_CONFIGS:
        raise ValueError(f"País no soportado: {country}")
    return COUNTRY_CONFIGS[country]

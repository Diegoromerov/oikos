"""Seed data para desarrollo."""

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.user import User
from app.models.beauty_profile import BeautyProfile
from app.models.biometric_consent import BiometricConsent
from app.models.tiktok_hashtag_trend import TikTokHashtagTrend


async def seed_users():
    """Crea usuarios de prueba."""
    async with async_session_factory() as session:
        # Verificar si ya existen usuarios
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Ya existen usuarios, saltando seed...")
            return
        
        # Crear 10 usuarios de prueba
        users = []
        for i in range(1, 11):
            user = User(
                email=f"test{i}@glowapp.co",
                hashed_password=f"hashed_password{i}",
                full_name=f"Usuario Test {i}",
                phone=f"+57300123{i:04d}",
                city="Bogotá",
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            users.append(user)
        
        await session.commit()
        print(f"✅ Creados {len(users)} usuarios de prueba")
        
        # Crear beauty profiles para los primeros 5 usuarios
        for user in users[:5]:
            profile = BeautyProfile(
                user_id=user.id,
                skin_subtone="warm",
                skin_subtone_confidence=0.85,
                skin_concerns=[
                    {
                        "type": "dehydration",
                        "severity": "mild",
                        "detected_at": datetime.utcnow().isoformat(),
                        "confidence": 0.90,
                    }
                ],
                hair_diagnosis={
                    "porosity": "medium",
                    "damage_level": "mild",
                    "hair_type": "wavy",
                    "density": "medium",
                    "detected_at": datetime.utcnow().isoformat(),
                },
                hand_morphology={
                    "hand_shape": "oval",
                    "finger_length": "medium",
                    "recommended_nail_shape": "oval",
                    "detected_at": datetime.utcnow().isoformat(),
                },
                brow_visajismo={
                    "face_shape": "oval",
                    "ideal_brow_start": 0.25,
                    "ideal_brow_arch": 0.67,
                    "ideal_brow_end": 0.90,
                    "symmetry_score": 0.88,
                    "detected_at": datetime.utcnow().isoformat(),
                },
                beauty_score=78,
            )
            session.add(profile)
        
        await session.commit()
        print("✅ Creados 5 beauty profiles de prueba")
        
        # Crear consentimientos para los primeros 3 usuarios
        for user in users[:3]:
            consent = BiometricConsent(
                user_id=user.id,
                version="1.0",
                consent_type="standard",
                accepted_at=datetime.utcnow(),
                ip_address="127.0.0.1",
                user_agent="Seed Script",
                consent_text_hash="abc123def456",
            )
            session.add(consent)
        
        await session.commit()
        print("✅ Creados 3 consentimientos de prueba")


async def seed_tiktok_trends():
    """Crea tendencias de TikTok de prueba (basadas en datos reales)."""
    async with async_session_factory() as session:
        # Verificar si ya existen tendencias
        result = await session.execute(select(TikTokHashtagTrend).limit(1))
        if result.scalar_one_or_none():
            print("Ya existen tendencias, saltando seed...")
            return
        
        # Datos basados en el análisis real de TikTok Colombia
        trends_data = [
            {
                "hashtag": "grwm",
                "category": "rutina_cuidado",
                "category_label": "Rutina y estructura de cuidado",
                "volume": 58352472,
                "growth_percentage": 10.0,
                "is_new": True,
            },
            {
                "hashtag": "tiktokmademebuyit",
                "category": "producto_resena",
                "category_label": "Producto y reseña (comercial)",
                "volume": 56071490,
                "growth_percentage": 7.0,
                "is_new": True,
            },
            {
                "hashtag": "glowup",
                "category": "glow_estetica",
                "category_label": "Glow / estética resultado",
                "volume": 43595110,
                "growth_percentage": 15.0,
                "is_new": True,
            },
            {
                "hashtag": "colombiaskincare",
                "category": "local_colombia",
                "category_label": "Local / cultural Colombia",
                "volume": 1440807,
                "growth_percentage": 211.0,
                "is_new": True,
            },
            {
                "hashtag": "bakuchiol",
                "category": "ingredientes_activos",
                "category_label": "Ingredientes activos",
                "volume": 2106119,
                "growth_percentage": 195.0,
                "is_new": True,
            },
            {
                "hashtag": "niacinamida",
                "category": "ingredientes_activos",
                "category_label": "Ingredientes activos",
                "volume": 8217601,
                "growth_percentage": 99.0,
                "is_new": True,
            },
            {
                "hashtag": "bogotabeauty",
                "category": "local_colombia",
                "category_label": "Local / cultural Colombia",
                "volume": 828172,
                "growth_percentage": 146.0,
                "is_new": True,
            },
            {
                "hashtag": "mitosskincare",
                "category": "diagnostico_educacion",
                "category_label": "Diagnóstico / educación dermatológica",
                "volume": 2701995,
                "growth_percentage": 158.0,
                "is_new": True,
            },
        ]
        
        for trend_data in trends_data:
            trend = TikTokHashtagTrend(
                **trend_data,
                last_updated=datetime.utcnow(),
            )
            session.add(trend)
        
        await session.commit()
        print(f"✅ Creadas {len(trends_data)} tendencias de TikTok")


async def main():
    """Ejecuta todos los seeds."""
    print("🌱 Iniciando seed data...")
    await seed_users()
    await seed_tiktok_trends()
    print("✅ Seed data completado")


if __name__ == "__main__":
    asyncio.run(main())

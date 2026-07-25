"""Cliente Redis async para caché y colas."""

from redis.asyncio import Redis

from app.core.config import settings


redis_client: Redis | None = None


async def init_redis() -> Redis:
    """Inicializa el cliente Redis."""
    global redis_client
    redis_client = Redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        socket_timeout=5,
        socket_connect_timeout=5,
        retry_on_timeout=True,
    )
    # Verificar conexión de manera segura
    try:
        await redis_client.ping()
    except Exception as e:
        print(f"WARNING: Redis no esta disponible ({e}). El servidor continuara sin cache de Redis.")
    return redis_client


async def close_redis() -> None:
    """Cierra el cliente Redis."""
    global redis_client
    if redis_client:
        await redis_client.close()


def get_redis() -> Redis:
    """Retorna el cliente Redis (debe estar inicializado)."""
    if redis_client is None:
        raise RuntimeError("Redis no está inicializado. Llama init_redis() primero.")
    return redis_client

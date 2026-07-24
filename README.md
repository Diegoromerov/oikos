# GlowApp Backend API

Servicio backend de FastAPI para el orquestador de IA y procesamiento de diagnósticos de belleza de GlowApp.

## 🚀 Setup Local

Asegúrate de configurar tu archivo `.env` a partir de `.env.example`.

```bash
# Instalar dependencias
poetry install

# Ejecutar pruebas
poetry run pytest

# Iniciar servidor de desarrollo
poetry run uvicorn app.main:app --reload
```

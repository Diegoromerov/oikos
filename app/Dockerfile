FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar Poetry
RUN pip install --no-cache-dir poetry

# Copiar archivos de dependencias usando la raíz del contexto (backend/)
COPY pyproject.toml poetry.lock* ./

# Configurar poetry para instalar dependencias globalmente en el contenedor
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

# Copiar todo el contenido de backend (el contexto)
COPY . ./

ENV PORT=8000
EXPOSE 8000

# Iniciar la aplicación FastAPI
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4

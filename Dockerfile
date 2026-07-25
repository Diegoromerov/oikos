FROM node:20-slim

WORKDIR /app

# Instalar herramientas de compilación para posibles dependencias nativas de npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Instalar dependencias en producción
RUN npm ci --only=production

COPY . .

# Usar el puerto dinámico de Railway
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]

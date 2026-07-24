// backend/src/config/redis.js
const redis = require('redis');
require('dotenv').config();

// Validar y limpiar la URL de Redis para evitar crashes por strings como 'redis://:'
let redisUrl = process.env.REDIS_URL;
if (!redisUrl || redisUrl === 'redis://:' || redisUrl.trim() === '') {
  redisUrl = 'redis://localhost:6379';
}

const redisClient = redis.createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  // Solo imprimimos un aviso simple una vez o cuando hay cambios de estado para evitar inundar la terminal/logs de Railway
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  Redis Client Error:', err.message);
  }
});
redisClient.on('connect', () => console.log('Redis connected'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('⚠️  No se pudo conectar a Redis. El cache biométrico continuará en modo local o sin persistencia de caché.', err.message);
  }
})();

module.exports = redisClient;

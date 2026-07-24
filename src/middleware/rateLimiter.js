const NodeCache = require('node-cache');
const usageCache = new NodeCache({ stdTTL: 86400 }); // 1 día default TTL

/**
 * Rate limiting middleware factory.
 *
 * If called without options, it limits each authenticated user to a maximum of 3 Gemini analyses per day.
 * If options are provided (windowMs, max, message), it creates a generic limiter based on the request IP.
 *
 * @param {Object} [options] - Configuration for generic rate limiting.
 * @param {number} [options.windowMs=86400000] - Time window in milliseconds.
 * @param {number} [options.max=100] - Maximum allowed requests in the window.
 * @param {string} [options.message='Too many requests'] - Message returned when limit is exceeded.
 * @returns {function} Express middleware.
 */
module.exports = (options = {}) => {
  const { windowMs = 86400000, max = 100, message = 'Too many requests' } = options;

  // Determine whether we are in "user" mode (no options) or "IP" mode (options provided)
  const isUserMode = Object.keys(options).length === 0;

  return (req, res, next) => {
    try {
      if (isUserMode) {
        const userId = req.userId || (req.user && req.user.id);
        if (!userId) return next();
        const key = `usage_${userId}_${new Date().toDateString()}`;
        const current = usageCache.get(key) || 0;
        if (current >= 3) {
          return res.status(429).json({ error: 'Límite diario alcanzado', message: 'Máximo 3 análisis por día' });
        }
        usageCache.set(key, current + 1);
        return next();
      } else {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
        const windowStart = Math.floor(Date.now() / windowMs);
        const key = `ip_${ip}_${windowStart}`;
        const current = usageCache.get(key) || 0;
        if (current >= max) {
          return res.status(429).json({ error: message });
        }
        usageCache.set(key, current + 1);
        return next();
      }
    } catch (err) {
      console.error('RateLimiter error:', err);
      return res.status(500).json({ error: 'Error interno del limitador de peticiones' });
    }
  };
};

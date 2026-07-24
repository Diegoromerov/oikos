// backend/src/middleware/biometricConsent.js
const { pool } = require('../config/db');

/**
 * Middleware para exigir consentimiento biométrico y procesar opciones de retención de datos.
 */
async function requireBiometricConsent(req, res, next) {
  try {
    const userId = req.user.id;

    // Buscar si el usuario tiene consentimiento otorgado
    const query = `
      SELECT id, consent_type, metadata, ip_address, created_at
      FROM biometric_consents
      WHERE user_id = $1 AND consent_type = 'BIOMETRIC_DATA'
      ORDER BY created_at DESC LIMIT 1
    `;
    const { rows } = await pool.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(403).json({
        error: 'Consentimiento biométrico requerido. Por favor acepta los términos de uso de datos biométricos.'
      });
    }

    const consent = rows[0];
    
    // DECISIÓN 4: Configurar los días de retención de datos del diagnóstico
    // Si dias_retencion = 1, equivale a modo incógnito (borrado en 24h)
    let retentionDays = 30;
    try {
      const meta = typeof consent.metadata === 'string' ? JSON.parse(consent.metadata) : consent.metadata;
      retentionDays = meta?.daysRetention || 30;
    } catch (_) {}

    req.retentionDays = retentionDays;

    next();
  } catch (error) {
    console.error('Error en requireBiometricConsent:', error);
    res.status(500).json({ error: 'Error interno al validar consentimiento biométrico.' });
  }
}

module.exports = { requireBiometricConsent };

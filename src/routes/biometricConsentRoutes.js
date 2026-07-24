// backend/src/routes/biometricConsentRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// POST /api/consent
// Guarda o registra consentimiento
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { version, accepted } = req.body;
  
  if (accepted !== true) {
    return res.status(400).json({ error: 'Debe aceptar los términos para continuar.' });
  }

  const clientIP = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    // Desactivar consentimientos anteriores del usuario
    await pool.query(
      `UPDATE biometric_consents 
       SET active = false, revoked_at = NOW() 
       WHERE user_id = $1 AND active = true`,
      [parseInt(userId, 10)]
    );

    // Insertar nuevo consentimiento activo
    const result = await pool.query(
      `INSERT INTO biometric_consents (user_id, version, ip, user_agent, active) 
       VALUES ($1, $2, $3, $4, true) 
       RETURNING id`,
      [parseInt(userId, 10), version || '1.0', clientIP, userAgent]
    );

    res.status(201).json({ 
      success: true, 
      consentId: result.rows[0].id 
    });
  } catch (error) {
    console.error('❌ Error guardando consentimiento biométrico:', error.message);
    res.status(500).json({ error: 'Error interno al registrar el consentimiento legal.' });
  }
});

// POST /api/consent/revoke
// Revoca el consentimiento biométrico
router.post('/revoke', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE biometric_consents 
       SET active = false, revoked_at = NOW() 
       WHERE user_id = $1 AND active = true 
       RETURNING id`,
      [parseInt(userId, 10)]
    );

    res.json({ 
      success: true, 
      message: 'Consentimiento revocado con éxito.',
      revoked: result.rowCount > 0
    });
  } catch (error) {
    console.error('❌ Error revocando consentimiento biométrico:', error.message);
    res.status(500).json({ error: 'Error interno al revocar el consentimiento.' });
  }
});

// GET /api/consent/status/:userId
// Verifica si el usuario tiene consentimiento activo
router.get('/status/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, version, accepted_at 
       FROM biometric_consents 
       WHERE user_id = $1 AND active = true 
       LIMIT 1`,
      [parseInt(userId, 10)]
    );

    if (result.rows.length > 0) {
      res.json({ 
        success: true, 
        hasActiveConsent: true, 
        version: result.rows[0].version 
      });
    } else {
      res.json({ 
        success: true, 
        hasActiveConsent: false 
      });
    }
  } catch (error) {
    console.error('❌ Error consultando estado del consentimiento biométrico:', error.message);
    res.status(500).json({ error: 'Error interno al verificar el estado del consentimiento.' });
  }
});

module.exports = router;

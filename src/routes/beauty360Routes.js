// backend/src/routes/beauty360Routes.js
// NIA Beauty 360 — Routing
// Llama al ai-worker (FastAPI + Gemini) via HTTP interno.
// No requiere BullMQ/Redis.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireBiometricConsent } = require('../middleware/biometricConsent');
const { pool } = require('../config/db');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8001';

const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpeg|jpg|png|webp|heic|heif)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Formato no soportado'));
    }
    cb(null, true);
  },
});

// ── POST /api/v1/beauty360/consent ──────────────────────────────────────────
router.post('/consent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { consentBiometric, consentRetention, incognitoMode } = req.body;

    if (consentBiometric !== true) {
      return res.status(400).json({ error: 'consentBiometric debe ser true' });
    }

    const daysRetention = incognitoMode ? 1 : (consentRetention || 30);
    const ipRegistro = req.ip || req.connection.remoteAddress;

    // Verificar si la tabla de auditoría existe
    try {
      await pool.query(`
        INSERT INTO biometric_consents
          (user_id, consent_type, accepted_at, ip_address, metadata)
        VALUES ($1, $2, NOW(), $3, $4)
        RETURNING id
      `, [
        userId, 
        'BIOMETRIC_DATA', 
        ipRegistro, 
        JSON.stringify({ daysRetention, incognitoMode: incognitoMode || false })
      ]);
    } catch (dbErr) {
      // Tabla puede no existir en dev — solo loguear, no fallar
      console.warn('Tabla biometric_consents no existe:', dbErr.message);
    }

    res.status(201).json({
      consentId: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      retentionDays: daysRetention,
    });
  } catch (error) {
    console.error('Error /consent:', error);
    res.status(500).json({ error: 'Error guardando consentimiento' });
  }
});

// ── POST /api/v1/beauty360/analyze ──────────────────────────────────────────
//Llama al ai-worker, espera resultado, guarda en BD y retorna analysisId.
// El frontend hace polling a /results/:id.
router.post('/analyze',
  authMiddleware,
  requireBiometricConsent,
  scanUpload.fields([
    { name: 'frontFace', maxCount: 1 },
    { name: 'profile', maxCount: 1 },
    { name: 'hair', maxCount: 1 },
    { name: 'wrist', maxCount: 1 },
  ]),
  async (req, res, next) => {
    let tempDir;
    let imagePaths = {};

    try {
      if (!req.files || Object.keys(req.files).length !== 4) {
        return res.status(400).json({ error: 'Se requieren 4 imágenes: frontFace, profile, hair, wrist' });
      }

      // Guardar imágenes temporales
      tempDir = path.join(__dirname, '../../uploads/temp');
      await fs.mkdir(tempDir, { recursive: true });

      const fieldMap = {
        frontFace: 'face_frontal',
        profile: 'face_lateral',
        hair: 'hair',
        wrist: 'hand',
      };

      for (const [key, files] of Object.entries(req.files)) {
        const ext = path.extname(files[0].originalname) || '.jpg';
        const fileField = fieldMap[key];
        const tempPath = path.join(tempDir, `scan-${crypto.randomUUID()}-${key}${ext}`);
        await fs.writeFile(tempPath, files[0].buffer);
        imagePaths[fileField] = tempPath;
      }

      const analysisId = crypto.randomUUID();
      const incognitoMode = req.retentionDays === 1;

      // Registrar job en BD como 'processing'
      try {
        await pool.query(`
          INSERT INTO beauty_scan_jobs (job_id, user_id, state, started_at, incognito_mode)
          VALUES ($1, $2, 'processing', NOW(), $3)
        `, [analysisId, req.user.id, incognitoMode]);
      } catch (dbErr) {
        console.warn('beauty_scan_jobs no existe todavía:', dbErr.message);
      }

      // Llamar al ai-worker vía HTTP interno (misma red Docker)
      let form;
      try {
        const FormData = require('form-data');
        form = new FormData();
        form.append('user_id', String(req.user.id));
        form.append('incognito_mode', incognitoMode ? 'true' : 'false');
        form.append('lens_id', 'nia_beauty_360');

        for (const [field, filePath] of Object.entries(imagePaths)) {
          form.append(field, fs.createReadStream(filePath), {
            filename: `${field}.jpg`,
            contentType: 'image/jpeg',
          });
        }

        const response = await axios.post(
          `${AI_WORKER_URL}/api/v1/beauty-scan`,
          form,
          { headers: form.getHeaders(), timeout: 120_000 }
        );

        const { beauty_profile: profile } = response.data;

        // Guardar resultado en BD
        try {
          await pool.query(`
            UPDATE beauty_scan_jobs
            SET state = 'completed',
                result = $1,
                completed_at = NOW(),
                season = $2,
                undertone = $3,
                updated_at = NOW()
            WHERE job_id = $4
          `, [
            JSON.stringify(profile),
            profile?.skin_subtone || null,
            profile?.skin_subtone || null,
            analysisId,
          ]);
        } catch (dbErr) {
          console.warn('beauty_scan_jobs update falló:', dbErr.message);
        }

        res.status(202).json({
          analysisId,
          status: 'completed',
          result: profile,
        });

      } catch (aiErr) {
        // Ai-worker no disponible o falló
        const errorMsg = aiErr.response?.data?.detail || aiErr.message;

        try {
          await pool.query(`
            UPDATE beauty_scan_jobs
            SET state = 'failed', error_message = $1, completed_at = NOW()
            WHERE job_id = $2
          `, [errorMsg, analysisId]);
        } catch (dbErr) {
          console.warn('beauty_scan_jobs update (error) falló:', dbErr.message);
        }

        return res.status(502).json({
          analysisId,
          status: 'failed',
          error: `Ai-worker no disponible: ${errorMsg}`,
        });
      }

    } catch (error) {
      next(error);
    } finally {
      // Limpiar imágenes temporales
      for (const filePath of Object.values(imagePaths)) {
        try {
          if (filePath) await fs.unlink(filePath);
        } catch (_) { /* ignorar */ }
      }
    }
  }
);

// ── GET /api/v1/beauty360/results/:id ────────────────────────────────────────
router.get('/results/:id', authMiddleware, async (req, res) => {
  try {
    try {
      const { rows } = await pool.query(`
        SELECT job_id, state, result, season, undertone, error_message, completed_at
        FROM beauty_scan_jobs
        WHERE job_id = $1 AND user_id = $2
      `, [req.params.id, req.user.id]);

      if (!rows.length) {
        return res.status(404).json({ error: 'Resultado no encontrado' });
      }

      const record = rows[0];

      if (record.state === 'processing') {
        return res.json({ status: 'processing', analysisId: record.job_id });
      }

      if (record.state === 'failed') {
        return res.status(500).json({ status: 'failed', error: record.error_message });
      }

      const result = typeof record.result === 'string'
        ? JSON.parse(record.result)
        : record.result;

      return res.json({
        status: 'completed',
        analysisId: record.job_id,
        season: record.season,
        undertone: record.undertone,
        completedAt: record.completed_at,
        ...result,
      });
    } catch (dbErr) {
      // Tabla no existe en dev
      return res.status(404).json({ error: 'Resultado no encontrado' });
    }
  } catch (error) {
    console.error('Error /results:', error);
    res.status(500).json({ error: 'Error consultando resultados' });
  }
});

// ── GET /api/v1/beauty360/history ─────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    try {
      const { rows } = await pool.query(`
        SELECT job_id, state, season, undertone, completed_at, incognito_mode
        FROM beauty_scan_jobs
        WHERE user_id = $1 AND state = 'completed'
        ORDER BY completed_at DESC
        LIMIT 20
      `, [req.user.id]);

      return res.json({ analyses: rows });
    } catch (dbErr) {
      return res.json({ analyses: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error consultando historial' });
  }
});

module.exports = router;

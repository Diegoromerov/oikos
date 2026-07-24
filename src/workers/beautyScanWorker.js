// backend/src/workers/beautyScanWorker.js
// Llama al ai-worker (FastAPI + Gemini) via HTTP en lugar de BullMQ local.
// Se inicializa desde backend/index.js.
//
// AI_WORKER_URL puede ser:
//   - En Railway/Docker: http://ai-worker:8001
//   - En local dev:       http://localhost:8001
const axios = require('axios');
const scanLogger = require('../utils/scanLogger');
const { pool } = require('../config/db');
const fs = require('fs');
const FormData = require('form-data');

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8001';

// ── Procesar job: llama al ai-worker y guarda resultado ────────────────
async function processBeautyScanJob(jobId, userId, imagePaths, incognitoMode) {
  let form;
  let formFiles;

  try {
    scanLogger.info('Enviando imágenes al ai-worker', { jobId, userId });

    // Construir FormData con las 4 imágenes
    form = new FormData();
    form.append('user_id', String(userId));
    form.append('incognito_mode', incognitoMode ? 'true' : 'false');
    form.append('lens_id', 'nia_beauty_360');

    const fieldMap = {
      frontFace: 'face_frontal',
      profile: 'face_lateral',
      hair: 'hair',
      wrist: 'hand',
    };

    for (const [field, fileField] of Object.entries(fieldMap)) {
      const filePath = imagePaths[field];
      if (filePath && fs.existsSync(filePath)) {
        form.append(fileField, fs.createReadStream(filePath), {
          filename: `${field}.jpg`,
          contentType: 'image/jpeg',
        });
      }
    }

    // Llamada HTTP al ai-worker
    const response = await axios.post(
      `${AI_WORKER_URL}/api/v1/beauty-scan`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 120_000, // 2 min para análisis Gemini
      }
    );

    const { beauty_profile: profile } = response.data;

    // Guardar resultado en BD
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
      jobId,
    ]);

    scanLogger.info('NIA Beauty 360 completado', {
      jobId,
      season: profile?.skin_subtone,
      score: profile?.beauty_score,
    });

    return profile;

  } catch (error) {
    const message = error.response?.data?.detail || error.message || 'Error desconocido';

    scanLogger.error('Error en NIA Beauty 360', { jobId, error: message });

    await pool.query(`
      UPDATE beauty_scan_jobs
      SET state = 'failed',
          error_message = $1,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE job_id = $2
    `, [message, jobId]);

    throw error;
  } finally {
    // Limpiar imágenes temporales
    if (imagePaths) {
      for (const path of Object.values(imagePaths)) {
        try {
          if (path && fs.existsSync(path)) fs.unlinkSync(path);
        } catch (e) {
          console.error(`⚠️ No se pudo borrar ${path}:`, e.message);
        }
      }
    }
  }
}

module.exports = { processBeautyScanJob };

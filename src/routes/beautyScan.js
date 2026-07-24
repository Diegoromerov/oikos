// backend/src/routes/beautyScan.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fileType = require('file-type');
const beautyScanQueue = require('../queues/scanQueue');
const authMiddleware = require('../middleware/auth');
const { requireBiometricConsent } = require('../middleware/biometricConsent');
const scanLogger = require('../utils/scanLogger');
const fs = require('fs').promises;
const path = require('path');
const { pool } = require('../config/db');

// Configuración de Multer
const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB por imagen
    files: 4,
  },
  fileFilter: async (req, file, cb) => {
    const allowedExt = /\.(jpeg|jpg|png|webp|heic|heif)$/i;
    if (!allowedExt.test(file.originalname)) {
      return cb(new Error('Formato no soportado. Usa JPEG, PNG o WebP.'));
    }

    const buffer = file.buffer?.slice(0, 4096);
    if (buffer) {
      const type = await fileType.fromBuffer(buffer);
      if (!type || !type.mime.startsWith('image/')) {
        return cb(new Error('Archivo no es una imagen válida'));
      }
    }

    cb(null, true);
  },
});

router.post('/beauty-scan',
  authMiddleware,
  requireBiometricConsent,
  async (req, res, next) => {
    try {
      // Validar archivos
      scanUpload.fields([
        { name: 'frontFace', maxCount: 1 },
        { name: 'profile', maxCount: 1 },
        { name: 'hair', maxCount: 1 },
        { name: 'wrist', maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        if (!req.files || Object.keys(req.files).length !== 4) {
          return res.status(400).json({ error: 'Se requieren exactamente 4 imágenes' });
        }

        // Guardar imágenes temporales
        const imagePaths = {};
        const tempDir = path.join(__dirname, '../../uploads/temp');
        
        try {
          await fs.mkdir(tempDir, { recursive: true });
        } catch (dirErr) {
          // Ignorar si ya existe
        }
        
        for (const [key, files] of Object.entries(req.files)) {
          const file = files[0];
          const tempPath = path.join(tempDir, `scan-${Date.now()}-${key}.jpg`);
          await fs.writeFile(tempPath, file.buffer);
          imagePaths[key] = tempPath;
        }

        const incognito = req.retentionDays === 1;

        // Crear job en BullMQ
        const job = await beautyScanQueue.add({
          userId: req.user.id,
          images: imagePaths,
          incognitoMode: incognito,
          timestamp: Date.now(),
        });

        // Registrar en BD
        await pool.query(`
          INSERT INTO beauty_scan_jobs (job_id, user_id, state, started_at, incognito_mode)
          VALUES ($1, $2, 'processing', NOW(), $3)
        `, [job.id, req.user.id, incognito]);

        // Log estructurado
        scanLogger.info('Scan iniciado', {
          userId: req.user.id,
          jobId: job.id,
          filesCount: Object.keys(req.files).length,
          incognitoMode: incognito,
        });

        // Responder inmediatamente
        res.status(202).json({
          jobId: job.id,
          status: 'processing',
          estimatedTime: '15-30 segundos',
        });
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

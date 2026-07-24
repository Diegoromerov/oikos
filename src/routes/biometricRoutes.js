// backend/src/routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const orchestrator = require('../services/biometric/orchestrator');
const profileService = require('../services/biometric/profile.service');
const authMiddleware = require('../middleware/auth');

const Joi = require('joi');

const analyzeSchema = Joi.object({
  userId: Joi.string().required(),
  faceImage: Joi.string().base64().required(),
  handsImage: Joi.string().base64().required(),
  entryPoint: Joi.string().valid('ideas', 'other').default('ideas'),
  lat: Joi.number().min(-90).max(90).optional().allow(null),
  lng: Joi.number().min(-180).max(180).optional().allow(null),
});

// POST /api/biometric/analyze
router.post('/analyze', authMiddleware, async (req, res) => {
  const { error, value } = analyzeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { userId, faceImage, handsImage, entryPoint, lat, lng } = value;

  // Validar tamaño aproximado del payload base64 (máx 5MB)
  const faceSize = Buffer.from(faceImage, 'base64').length;
  const handsSize = Buffer.from(handsImage, 'base64').length;

  if (faceSize > 5 * 1024 * 1024 || handsSize > 5 * 1024 * 1024) {
    return res.status(400).json({
      error: 'Las imágenes no pueden superar el tamaño límite de 5MB por archivo.',
    });
  }

  try {
    const faceBuffer = Buffer.from(faceImage, 'base64');
    const handsBuffer = Buffer.from(handsImage, 'base64');

    const result = await orchestrator.analyze(
      userId,
      faceBuffer,
      handsBuffer,
      entryPoint || 'ideas',
      lat,
      lng
    );

    res.json({
      success: true,
      profileId: result.profileId,
      results: {
        face: result.face,
        hands: result.hands,
        recommendation: result.recommendation,
        keyIngredients: result.keyIngredients,
      },
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error('❌ Error en el orquestador biométrico:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el análisis biométrico. Por favor intenta nuevamente.',
    });
  }
});

// GET /api/biometric/profile/:userId
router.get('/profile/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const profile = await profileService.getProfile(parseInt(userId, 10));
    if (!profile) {
      return res.status(404).json({ error: 'Perfil biométrico no encontrado' });
    }
    res.json(profile);
  } catch (error) {
    console.error('❌ Error obteniendo perfil biométrico:', error.message);
    res.status(500).json({ error: 'Error al obtener el perfil biométrico' });
  }
});

// DELETE /api/biometric/profile/:userId
router.delete('/profile/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    await profileService.deleteProfile(parseInt(userId, 10));
    res.json({ success: true, message: 'Perfil biométrico eliminado correctamente (Habeas Data aplicado).' });
  } catch (error) {
    console.error('❌ Error eliminando perfil biométrico:', error.message);
    res.status(500).json({ error: 'Error al eliminar el perfil biométrico' });
  }
});

module.exports = router;

const youcamClient = require('./youcam.client');
const geminiClient = require('./gemini.client');
const profileService = require('./profile.service');
const openUV = require('../openUV');
const logger = require('../../config/logger');

class BiometricOrchestrator {
  /**
   * Orquesta el análisis completo: rostro + manos + recomendación
   * @param {string|number} userId - ID del usuario
   * @param {Buffer} faceImage - Imagen de rostro
   * @param {Buffer} handsImage - Imagen de manos
   * @param {string} entryPoint - 'ideas' (por defecto)
   * @param {number} [lat] - Latitud opcional
   * @param {number} [lng] - Longitud opcional
   * @returns {Promise<Object>} Resultado completo
   */
  async analyze(userId, faceImage, handsImage, entryPoint = 'ideas', lat, lng) {
    const parsedUserId = parseInt(userId, 10);
    logger.info('Iniciando análisis biométrico para el usuario', { userId: parsedUserId });

    // 1. Analizar rostro con YouCam Client
    let faceScores;
    try {
      faceScores = await youcamClient.analyzeFace(faceImage);
      logger.info('Análisis YouCam finalizado con éxito', { userId: parsedUserId });
    } catch (error) {
      logger.warn('YouCam falló, aplicando fallback local:', { userId: parsedUserId, error: error.message });
      faceScores = {
        hydration: 60,
        wrinkles: 30,
        spots: 40,
        pores: 35,
        subtono: 'neutro',
        bioAge: 35,
      };
    }

    // 2. Analizar manos con Gemini Vision
    let handsDiagnosis;
    try {
      handsDiagnosis = await geminiClient.analyzeHands(handsImage);
      logger.info('Análisis Gemini Vision de manos finalizado con éxito', { userId: parsedUserId });
    } catch (error) {
      logger.warn('Gemini Vision falló, aplicando fallback local:', { userId: parsedUserId, error: error.message });
      handsDiagnosis = {
        manchasSolares: 'leve',
        sequedad: 'moderada',
        cuticulas: 'sanas',
        unas: 'sanas',
        edadAparente: 35,
      };
    }

    // 3. Obtener índice UV (si se proporcionan coordenadas)
    let uvData = null;
    if (lat && lng) {
      try {
        uvData = await openUV.getUV(lat, lng);
        logger.info('OpenUV datos obtenidos', { userId: parsedUserId, uvData });
      } catch (error) {
        logger.warn('OpenUV falló:', { userId: parsedUserId, error: error.message });
      }
    }

    // 4. Generar recomendación con Gemini Text
    let recommendation;
    try {
      recommendation = await geminiClient.generateRecommendation(faceScores, handsDiagnosis);
      logger.info('Recomendación de Gemini Text generada con éxito', { userId: parsedUserId });
    } catch (error) {
      logger.warn('Gemini Text falló, aplicando fallback local:', { userId: parsedUserId, error: error.message });
      recommendation = geminiClient.getFallbackRecommendation();
    }

    if (uvData) {
      recommendation = `${recommendation}\n\n☀️ **Alerta FPS Activa:** ${uvData.recommendation} (Nivel de riesgo: ${uvData.riskLevel}, Índice UV: ${uvData.uv})`;
    }

    // 5. Extraer ingredientes activos sugeridos
    const keyIngredients = this.extractIngredients(recommendation);

    // 6. Guardar perfil final en base de datos e inyectar a Redis
    const profile = await profileService.saveProfile({
      userId: parsedUserId,
      faceScores,
      handsDiagnosis,
      recommendation,
      recommendedProducts: [], // Fase 4
      entryPoint,
      keyIngredients,
    });

    logger.info('Perfil biométrico guardado exitosamente', { userId: parsedUserId, profileId: profile.id });

    return {
      profileId: profile.id,
      face: faceScores,
      hands: handsDiagnosis,
      recommendation,
      keyIngredients,
      createdAt: profile.createdAt,
    };
  }

  /**
   * Extrae ingredientes sugeridos mediante escaneo por palabras clave
   */
  extractIngredients(recommendation) {
    const ingredientList = [
      'ácido hialurónico',
      'retinol',
      'vitamina c',
      'niacinamida',
      'ácido salicílico',
      'ácido glicólico',
      'ácido láctico',
      'coenzima q10',
      'péptidos',
      'ceramidas',
    ];

    const found = [];
    const lowerText = recommendation.toLowerCase();
    for (const ingredient of ingredientList) {
      if (lowerText.includes(ingredient)) {
        found.push(ingredient);
      }
    }
    return found.slice(0, 5);
  }
}

module.exports = new BiometricOrchestrator();

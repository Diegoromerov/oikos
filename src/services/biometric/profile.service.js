// backend/src/services/biometric/profile.service.js
const { pool } = require('../../config/db');
const redisClient = require('../../config/redis');

const PROFILE_TTL = 30 * 24 * 60 * 60; // 30 días en segundos

class ProfileService {
  /**
   * Guarda o actualiza un perfil biométrico
   */
  async saveProfile(profileData) {
    const {
      userId,
      faceScores,
      handsDiagnosis,
      recommendation,
      recommendedProducts = [],
      entryPoint = 'ideas',
      keyIngredients = [],
    } = profileData;

    const faceScoresStr = JSON.stringify(faceScores);
    const handsDiagnosisStr = JSON.stringify(handsDiagnosis);
    const recommendedProductsStr = JSON.stringify(recommendedProducts);

    // Upsert en PostgreSQL
    const upsertQuery = `
      INSERT INTO beauty_profiles (user_id, face_scores, hands_diagnosis, recommendation, recommended_products, entry_point, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        face_scores = EXCLUDED.face_scores,
        hands_diagnosis = EXCLUDED.hands_diagnosis,
        recommendation = EXCLUDED.recommendation,
        recommended_products = EXCLUDED.recommended_products,
        entry_point = EXCLUDED.entry_point,
        updated_at = NOW()
      RETURNING *;
    `;

    const upsertRes = await pool.query(upsertQuery, [
      userId,
      faceScoresStr,
      handsDiagnosisStr,
      recommendation,
      recommendedProductsStr,
      entryPoint,
    ]);

    const profile = upsertRes.rows[0];

    // Guardar en historial biométrico para auditoría y trazabilidad
    const historyQuery = `
      INSERT INTO biometric_history (user_id, profile_id, face_scores, hands_diagnosis, recommendation)
      VALUES ($1, $2, $3, $4, $5);
    `;
    await pool.query(historyQuery, [
      userId,
      profile.id,
      faceScoresStr,
      handsDiagnosisStr,
      recommendation,
    ]);

    // Cachear en Redis
    const cacheData = {
      id: profile.id,
      userId: profile.user_id,
      faceScores,
      handsDiagnosis,
      recommendation,
      recommendedProducts,
      entryPoint,
      keyIngredients,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    try {
      await redisClient.setEx(
        `beauty:profile:${userId}`,
        PROFILE_TTL,
        JSON.stringify(cacheData)
      );
    } catch (err) {
      console.warn('⚠️  No se pudo escribir en la caché de Redis:', err.message);
    }

    return cacheData;
  }

  /**
   * Obtiene el perfil de un usuario (primero de Redis, luego BD)
   */
  async getProfile(userId) {
    try {
      const cached = await redisClient.get(`beauty:profile:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('⚠️  No se pudo leer de la caché de Redis:', err.message);
    }

    const selectQuery = `
      SELECT * FROM beauty_profiles
      WHERE user_id = $1;
    `;
    const res = await pool.query(selectQuery, [userId]);
    if (res.rows.length === 0) return null;

    const profile = res.rows[0];

    const faceScores = typeof profile.face_scores === 'string'
      ? JSON.parse(profile.face_scores)
      : profile.face_scores;

    const handsDiagnosis = typeof profile.hands_diagnosis === 'string'
      ? JSON.parse(profile.hands_diagnosis)
      : profile.hands_diagnosis;

    const recommendedProducts = typeof profile.recommended_products === 'string'
      ? JSON.parse(profile.recommended_products)
      : profile.recommended_products;

    const result = {
      id: profile.id,
      userId: profile.user_id,
      faceScores,
      handsDiagnosis,
      recommendation: profile.recommendation,
      recommendedProducts,
      entryPoint: profile.entry_point,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    try {
      await redisClient.setEx(
        `beauty:profile:${userId}`,
        PROFILE_TTL,
        JSON.stringify(result)
      );
    } catch (err) {
      console.warn('⚠️  No se pudo repoblar la caché de Redis:', err.message);
    }

    return result;
  }

  /**
   * Elimina el perfil (Derecho al Olvido / Habeas Data)
   */
  async deleteProfile(userId) {
    await pool.query('DELETE FROM beauty_profiles WHERE user_id = $1', [userId]);
    try {
      await redisClient.del(`beauty:profile:${userId}`);
    } catch (err) {
      console.warn('⚠️  Error al borrar caché de Redis:', err.message);
    }
    return true;
  }
}

module.exports = new ProfileService();

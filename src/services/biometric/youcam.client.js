// backend/src/services/biometric/youcam.client.js
const axios = require('axios');

class YouCamClient {
  constructor() {
    this.apiKey = process.env.YOCAM_API_KEY;
    this.baseUrl = 'https://api.youcam.ai/v1'; 
    this.timeout = 10000; // 10 segundos
  }

  /**
   * Analiza una imagen de rostro y devuelve scores dérmicos
   * @param {Buffer|string} image - Imagen en base64 o buffer
   * @returns {Promise<Object>} Scores de piel
   */
  async analyzeFace(image) {
    try {
      const base64Image = typeof image === 'string' ? image : image.toString('base64');

      // Si no hay API key de YouCam configurada, hacemos fallback a una simulación realista
      if (!this.apiKey || this.apiKey === 'tu_api_key_aqui') {
        console.warn('⚠️  YouCam API Key no configurada o por defecto. Retornando simulación de YouCam.');
        return {
          hydration: 68,
          wrinkles: 24,
          spots: 18,
          pores: 32,
          subtono: 'cálido',
          bioAge: 29,
          raw: { mock: true },
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/skin-analysis`,
        {
          image: base64Image,
          return_landmarks: false,
          return_age: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      const data = response.data;
      return {
        hydration: data.hydration || 0,
        wrinkles: data.wrinkles || 0,
        spots: data.spots || 0,
        pores: data.pores || 0,
        subtono: data.skin_tone || 'neutro',
        bioAge: data.estimated_age || 30,
        raw: data,
      };
    } catch (error) {
      console.error('YouCam API error:', error.response?.data || error.message);
      throw new Error(`YouCam failed: ${error.message}`);
    }
  }
}

module.exports = new YouCamClient();

// backend/src/services/biometric/gemini.client.js
const axios = require('axios');
const { HANDS_ANALYSIS_PROMPT, RECOMMENDATION_PROMPT } = require('./prompts');

class GeminiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.timeout = 15000; // 15 segundos
  }

  /**
   * Analiza una imagen de manos usando Gemini Vision
   * @param {Buffer|string} image - Imagen en base64 o buffer
   * @returns {Promise<Object>} Diagnóstico de manos
   */
  async analyzeHands(image) {
    try {
      const base64Image = typeof image === 'string' ? image : image.toString('base64');

      if (!this.apiKey || this.apiKey.includes('tu_api_key_aqui')) {
        return this.getFallbackHandsDiagnosis();
      }

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.0-flash-vision:generateContent?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: HANDS_ANALYSIS_PROMPT },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        },
        {
          timeout: this.timeout,
        }
      );

      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta de Gemini');
      }

      const diagnosis = JSON.parse(jsonMatch[0]);
      return {
        manchasSolares: diagnosis.manchas_solares || 'leve',
        sequedad: diagnosis.sequedad || 'leve',
        cuticulas: diagnosis.cuticulas || 'sanas',
        unas: diagnosis.uñas || diagnosis.unas || 'sanas',
        edadAparente: diagnosis.edad_aparente || 30,
      };
    } catch (error) {
      console.error('Gemini Vision error:', error.response?.data || error.message);
      return this.getFallbackHandsDiagnosis();
    }
  }

  getFallbackHandsDiagnosis() {
    return {
      manchasSolares: 'leve',
      sequedad: 'moderada',
      cuticulas: 'sanas',
      unas: 'sanas',
      edadAparente: 35,
    };
  }

  /**
   * Genera recomendación personalizada usando Gemini Text
   * @param {Object} faceScores - Scores de YouCam
   * @param {Object} handsDiagnosis - Diagnóstico de manos
   * @returns {Promise<string>} Recomendación en texto
   */
  async generateRecommendation(faceScores, handsDiagnosis) {
    try {
      const prompt = RECOMMENDATION_PROMPT
        .replace('{hydration}', faceScores.hydration)
        .replace('{wrinkles}', faceScores.wrinkles)
        .replace('{spots}', faceScores.spots)
        .replace('{pores}', faceScores.pores)
        .replace('{subtono}', faceScores.subtono)
        .replace('{bioAge}', faceScores.bioAge)
        .replace('{handSpots}', handsDiagnosis.manchasSolares)
        .replace('{handDryness}', handsDiagnosis.sequedad)
        .replace('{cuticles}', handsDiagnosis.cuticulas)
        .replace('{nails}', handsDiagnosis.unas || handsDiagnosis.uñas || 'sanas');

      if (!this.apiKey || this.apiKey.includes('tu_api_key_aqui')) {
        return this.getFallbackRecommendation();
      }

      const response = await axios.post(
        `${this.baseUrl}/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        },
        {
          timeout: this.timeout,
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini Text error:', error.response?.data || error.message);
      return this.getFallbackRecommendation();
    }
  }

  getFallbackRecommendation() {
    return `
**Diagnóstico general**
Tu piel presenta niveles óptimos de hidratación y cuidado general. Te sugerimos mantener una barrera cutánea sólida y proteger las áreas expuestas al sol.

**Rutina AM**
1. Limpiador facial suave
2. Sérum con Vitamina C o Ácido Hialurónico
3. Protector solar facial FPS 50+

**Rutina PM**
1. Limpieza profunda
2. Sérum hidratante de Niacinamida
3. Crema de noche reparadora

**Cuidado de Manos**
1. Exfoliación suave semanal
2. Crema reparadora con urea y ceramidas

*Ingredientes recomendados:* Ácido hialurónico, Niacinamida, Ceramidas.

¡La constancia es el secreto de una piel saludable!
    `;
  }
}

module.exports = new GeminiClient();

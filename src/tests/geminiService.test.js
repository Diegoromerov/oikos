// backend/src/tests/geminiService.test.js
const { pool } = require('../config/db');

// Mockear el pool de la base de datos
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mockear el servicio de websockets para evitar envíos en la prueba
jest.mock('../services/websocketService', () => ({
  notifyUserChatMessage: jest.fn()
}));

// Mockear la API de Google Generative AI
const mockGenerate = jest.fn().mockResolvedValue({
  response: {
    text: () => "Respuesta de Aura de prueba"
  }
});
const mockGetModel = jest.fn().mockReturnValue({
  generateContent: mockGenerate
});

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetModel
    }))
  };
});

// Importar después de configurar mocks
const { processAssistantMessage, AI_USER_ID } = require('../services/geminiService');

describe('Pruebas unitarias de Asistente de IA (geminiService.js)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Debería agrupar mensajes consecutivos del mismo emisor e impedir roles consecutivos', async () => {
    // 1. Configurar mock de base de datos
    pool.query.mockImplementation((queryText, params) => {
      if (queryText.includes('SELECT s.id as service_id')) {
        return Promise.resolve({ rows: [] });
      }
      if (queryText.includes('SELECT sender_id, receiver_id, message, created_at')) {
        return Promise.resolve({
          rows: [
            { sender_id: 1, receiver_id: 0, message: "Hola Aura, recomiéndame algo", created_at: new Date() },
            { sender_id: 1, receiver_id: 0, message: "Tengo piel grasa", created_at: new Date(Date.now() - 1000) },
            { sender_id: 0, receiver_id: 1, message: "Hola, soy Aura.", created_at: new Date(Date.now() - 2000) },
            { sender_id: 1, receiver_id: 0, message: "Hola", created_at: new Date(Date.now() - 3000) }
          ]
        });
      }
      if (queryText.includes('INSERT INTO messages')) {
        return Promise.resolve({
          rows: [
            { id: 'msg-id-123', sender_id: 0, receiver_id: 1, message: "Respuesta de Aura de prueba", is_read: false, created_at: new Date() }
          ]
        });
      }
    });

    // 2. Invocar la función con el mensaje actual
    await processAssistantMessage(1, "Hola Aura, recomiéndame algo", null);

    // 3. Verificar los argumentos pasados a Gemini
    expect(mockGetModel).toHaveBeenCalled();
    const contentsSent = mockGenerate.mock.calls[0][0].contents;

    // Verificar alternancia estricta de roles: no deben haber dos roles consecutivos iguales
    for (let i = 0; i < contentsSent.length - 1; i++) {
      expect(contentsSent[i].role).not.toBe(contentsSent[i + 1].role);
    }
  });
});

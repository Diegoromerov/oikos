// backend/scratch/test_chat_flow.js
const { getConversations, getMessages, sendMessage, readMessages } = require('../src/controllers/chatController');
const { pool } = require('../src/config/db');

// Mockear Express req y res para soportar encadenamiento como res.status(200).json(...)
function createMockResponse() {
  const res = {
    statusCode: 200,
    body: null
  };
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.body = data;
    return this;
  };
  return res;
}

async function runTest() {
  console.log('🧪 Iniciando prueba de flujo del chat (POST/GET/PATCH)...');

  // Verificar conexión de base de datos
  try {
    await pool.query('SELECT 1');
    console.log('✅ Base de datos conectada.');
  } catch (err) {
    console.warn('⚠️ No se pudo conectar a la base de datos local. Corriendo en modo MOCK.');
    setupMocks();
  }

  // 1. Probar POST /api/chat/messages (Enviar mensaje de Cliente a Prestador)
  console.log('\n--- 1. Enviando mensaje (POST /api/chat/messages) ---');
  const reqSend = {
    user: { id: 4, email: 'ana@cliente.com' }, // Cliente ID 4
    body: { receiver_id: '5', message: 'Hola Ana, ¿disponible el sábado?' } // Prestador ID 5
  };
  const resSend = createMockResponse();
  
  try {
    await sendMessage(reqSend, resSend);
    console.log('Respuesta recibida (Status:', resSend.statusCode, '):', JSON.stringify(resSend.body, null, 2));
  } catch (e) {
    console.error('Error en sendMessage:', e);
  }

  // 2. Probar GET /api/chat/messages/:partnerId (Obtener mensajes entre Cliente y Prestador)
  console.log('\n--- 2. Obteniendo historial de mensajes (GET /api/chat/messages/5) ---');
  const reqGetMsgs = {
    user: { id: 4 },
    params: { partnerId: '5' }
  };
  const resGetMsgs = createMockResponse();

  try {
    await getMessages(reqGetMsgs, resGetMsgs);
    console.log('Respuesta recibida (Status:', resGetMsgs.statusCode, '):', JSON.stringify(resGetMsgs.body, null, 2));
  } catch (e) {
    console.error('Error en getMessages:', e);
  }

  // 3. Probar GET /api/chat/conversations (Listar conversaciones activas)
  console.log('\n--- 3. Listando conversaciones activas (GET /api/chat/conversations) ---');
  const reqGetConvs = {
    user: { id: 4 }
  };
  const resGetConvs = createMockResponse();

  try {
    await getConversations(reqGetConvs, resGetConvs);
    console.log('Respuesta recibida (Status:', resGetConvs.statusCode, '):', JSON.stringify(resGetConvs.body, null, 2));
  } catch (e) {
    console.error('Error en getConversations:', e);
  }

  // 4. Probar PATCH /api/chat/messages/:partnerId/read (Marcar como leídos)
  console.log('\n--- 4. Marcando mensajes como leídos (PATCH /api/chat/messages/5/read) ---');
  const reqRead = {
    user: { id: 4 },
    params: { partnerId: '5' }
  };
  const resRead = createMockResponse();

  try {
    await readMessages(reqRead, resRead);
    console.log('Respuesta recibida (Status:', resRead.statusCode, '):', JSON.stringify(resRead.body, null, 2));
  } catch (e) {
    console.error('Error en readMessages:', e);
  }

  console.log('\n🏁 Fin de la prueba de flujo de chat.');
  process.exit(0);
}

function setupMocks() {
  const { sequelize } = require('../src/config/database');
  sequelize.query = async (sql, options) => {
    console.log(`[SQL Mock Executed]: ${sql.substring(0, 100).replace(/\n/g, ' ')}...`);
    if (sql.trim().startsWith('INSERT INTO messages')) {
      // Retorna el formato esperado para INSERT [rows, metadata]
      return [[{ id: 'new-msg-uuid', sender_id: 4, receiver_id: 5, message: 'Hola Ana, ¿disponible el sábado?', is_read: false, created_at: new Date() }]];
    }
    if (sql.trim().startsWith('SELECT id, sender_id, receiver_id')) {
      return [
        { id: 'msg-1', sender_id: 4, receiver_id: 5, message: 'Hola Ana, ¿disponible el sábado?', is_read: false, created_at: new Date() }
      ];
    }
    if (sql.includes('SELECT DISTINCT ON')) {
      return [
        { conversation_partner_id: 5, partner_name: 'Ana Silva', partner_avatar: null, partner_role: 'provider', last_message: 'Hola Ana, ¿disponible el sábado?', last_message_time: new Date(), sender_id: 4, unread_count: 0 }
      ];
    }
    if (sql.trim().startsWith('UPDATE messages')) {
      return [[{ id: 'msg-1' }]];
    }
    return [];
  };
}

// Ejecutar
if (require.main === module) {
  runTest();
}

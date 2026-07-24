// backend/src/services/websocketService.js
const { WebSocketServer } = require('ws');
const { pool } = require('../config/db');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

let wss = null;
const wsClients = new Map(); // userId -> Set of WS connections

const registerClient = (userId, ws) => {
  const userIdStr = userId.toString();
  if (!wsClients.has(userIdStr)) {
    wsClients.set(userIdStr, new Set());
  }
  wsClients.get(userIdStr).add(ws);
  console.log(`👤 Conexión WS registrada para usuario: ${userIdStr}`);
};

const unregisterClient = (ws) => {
  for (const [userId, connSet] of wsClients.entries()) {
    if (connSet.has(ws)) {
      connSet.delete(ws);
      if (connSet.size === 0) wsClients.delete(userId);
      console.log(`🔌 Conexión WS removida para usuario: ${userId}`);
      break;
    }
  }
};

const notifyUserChatMessage = (userId, messageData) => {
  const userIdStr = userId.toString();
  if (wsClients.has(userIdStr)) {
    const payload = JSON.stringify({
      type: 'chat_message',
      data: messageData
    });
    for (const conn of wsClients.get(userIdStr)) {
      if (conn.readyState === 1) { // OPEN
        conn.send(payload);
      }
    }
  }
};

const initWebSocketServer = (server) => {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('🔌 Nuevo cliente WebSocket conectado.');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'register') {
          if (data.token) {
            try {
              const decoded = jwt.verify(data.token, getJwtSecret());
              const verifiedUserId = decoded.id;
              registerClient(verifiedUserId, ws);
              ws.send(JSON.stringify({ status: 'registered', userId: verifiedUserId.toString() }));
            } catch (jwtErr) {
              console.error('WebSocket JWT verification failed:', jwtErr.message);
              ws.send(JSON.stringify({ error: 'Token inválido o expirado' }));
            }
          } else if (data.userId) {
            console.warn(`⚠️ WebSocket registrado por ID plano (sin token) para pruebas. Usuario: ${data.userId}`);
            registerClient(data.userId, ws);
            ws.send(JSON.stringify({ status: 'registered', userId: data.userId.toString(), warning: 'No token verification' }));
          }
        }
        // Integración de Geolocalización en Tiempo Real vía WebSockets para Tracking
        if (data.type === 'join_booking_room' && data.bookingId) {
          ws.bookingId = data.bookingId;
          ws.role = data.role || 'client';
          console.log(`📡 Cliente WS unido a la sala del booking_${data.bookingId} como ${ws.role}`);
          ws.send(JSON.stringify({ type: 'joined_room', bookingId: data.bookingId }));
        }
        if (data.type === 'location_update' && data.bookingId && data.latitude && data.longitude) {
          console.log(`📍 Recibida coordenada GPS de prestador para booking_${data.bookingId}: ${data.latitude}, ${data.longitude}`);
          
          // Actualizar base de datos de manera hiper-local
          if (data.providerId) {
            pool.query(
              `UPDATE perfiles_prestador 
               SET ubicacion = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography 
               WHERE id = $3`,
              [data.latitude, data.longitude, data.providerId]
            ).catch(e => console.error('Error actualizando ubicación prestador:', e.message));
          }

          // Retransmitir a todos los clientes que estén en el mismo bookingId
          const payload = JSON.stringify({
            type: 'location_received',
            bookingId: data.bookingId,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: new Date().toISOString()
          });

          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1 && client.bookingId === data.bookingId) {
              client.send(payload);
            }
          });
        }
      } catch (err) {
        console.error('Error procesando mensaje WebSocket:', err);
      }
    });
    
    ws.on('close', () => {
      unregisterClient(ws);
    });
  });
  
  return wss;
};

const notifyProviderNewBooking = (providerId, message) => {
  const providerIdStr = providerId.toString();
  if (wsClients.has(providerIdStr)) {
    const payload = JSON.stringify({
      type: 'new_booking',
      data: {
        message: message,
        sound_text: 'glowapp'
      }
    });
    for (const conn of wsClients.get(providerIdStr)) {
      if (conn.readyState === 1) { // OPEN
        conn.send(payload);
      }
    }
  }
};

module.exports = {
  registerClient,
  unregisterClient,
  notifyUserChatMessage,
  initWebSocketServer,
  notifyProviderNewBooking
};

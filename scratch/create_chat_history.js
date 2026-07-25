// backend/scratch/create_chat_history.js
const { pool } = require('../src/config/db');

async function createChat() {
  try {
    const diegoEmail = 'diego@beautyapp.com';
    const anaEmail = 'anasilva@beautyapp.com';

    // 1. Get User IDs
    const usersRes = await pool.query(
      "SELECT id, nombre, rol FROM usuarios WHERE email IN ($1, $2)",
      [diegoEmail, anaEmail]
    );

    let diegoId = null;
    let anaId = null;

    for (const row of usersRes.rows) {
      if (row.rol === 'CLIENTE') diegoId = row.id;
      if (row.rol === 'PRESTADOR') anaId = row.id;
    }

    if (!diegoId || !anaId) {
      throw new Error(`Could not find Diego (ID found: ${diegoId}) or Ana (ID found: ${anaId}) in DB.`);
    }

    console.log(`Found Users - Diego (Cliente): ID ${diegoId}, Ana (Prestadora): ID ${anaId}`);

    // 2. Clear old messages between these two (if any) to start clean
    console.log('Cleaning old messages between them...');
    await pool.query(`
      DELETE FROM messages 
      WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1)
    `, [diegoId, anaId]);

    // 3. Insert fresh messages
    console.log('Inserting chat history...');
    const conversation = [
      {
        sender: diegoId,
        receiver: anaId,
        msg: "Hola Ana, ¿cómo estás? Te escribo para consultar si tienes disponibilidad para el servicio de manicure el próximo sábado por la tarde.",
        delayMinutes: 20
      },
      {
        sender: anaId,
        receiver: diegoId,
        msg: "¡Hola Diego! Qué gusto saludarte. Sí, tengo disponibilidad a las 3:00 PM y a las 5:00 PM. ¿Te queda bien alguno de esos horarios?",
        delayMinutes: 15
      },
      {
        sender: diegoId,
        receiver: anaId,
        msg: "¡Excelente! Me vendría perfecto separar el turno de las 3:00 PM. ¿Qué costo tiene?",
        delayMinutes: 10
      },
      {
        sender: anaId,
        receiver: diegoId,
        msg: "Listo, te reservo a las 3:00 PM. El costo del manicure semipermanente premium es de $45.000 COP. ¿Deseas agregar algún diseño especial?",
        delayMinutes: 5
      },
      {
        sender: diegoId,
        receiver: anaId,
        msg: "Sí, por favor, me gustaría algo sencillo. Ya mismo reservo a través de GlowApp. ¡Muchas gracias!",
        delayMinutes: 1
      }
    ];

    const now = new Date();
    for (let i = 0; i < conversation.length; i++) {
      const item = conversation[i];
      // Set timestamp descending to simulate timing flow
      const createdTime = new Date(now.getTime() - (item.delayMinutes * 60 * 1000));
      
      await pool.query(`
        INSERT INTO messages (id, sender_id, receiver_id, message, is_read, created_at)
        VALUES (
          gen_random_uuid(), 
          $1, 
          $2, 
          $3, 
          $4, 
          $5
        )
      `, [item.sender, item.receiver, item.msg, i < conversation.length - 1, createdTime]);
    }

    console.log('Chat history generated successfully!');
    
    // Verify insertion
    const countRes = await pool.query(`
      SELECT count(*) FROM messages 
      WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1)
    `, [diegoId, anaId]);
    
    console.log(`Total messages in DB between them: ${countRes.rows[0].count}`);

  } catch (err) {
    console.error('Error generating chat:', err);
  } finally {
    pool.end();
  }
}

createChat();

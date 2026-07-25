// backend/scratch/test_tickets.js
const { sequelize } = require('../src/config/database');
const { QueryTypes } = require('sequelize');

async function testTickets() {
  console.log('🧪 Iniciando pruebas de base de datos de soporte y tickets...');
  try {
    // 1. Verificar existencia de las tablas
    const tableCheck = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('tickets', 'ticket_mensajes');
    `, { type: QueryTypes.SELECT });

    console.log('Tables found:', tableCheck);

    if (tableCheck.length < 2) {
      throw new Error('❌ Error: Las tablas "tickets" o "ticket_mensajes" no se crearon correctamente.');
    }

    console.log('✅ Tablas verificadas exitosamente.');

    // 2. Obtener un usuario de prueba para asociar el ticket
    const userQuery = 'SELECT id, email, nombre FROM usuarios LIMIT 1;';
    const users = await sequelize.query(userQuery, { type: QueryTypes.SELECT });

    if (users.length === 0) {
      console.log('⚠️ No hay usuarios en la base de datos para probar.');
      return;
    }

    const testUser = users[0];
    console.log(`👤 Usando usuario de prueba: ${testUser.nombre} (${testUser.email})`);

    // 3. Crear un ticket de prueba
    console.log('➕ Creando ticket de prueba...');
    const insertTicketQuery = `
      INSERT INTO tickets (usuario_id, tipo, categoria, asunto, descripcion)
      VALUES (:userId, 'RECLAMO', 'servicio', 'Prueba automatizada', 'Esta es una prueba de radicación de ticket in-house.')
      RETURNING id, asunto, estado, prioridad;
    `;
    const ticketResult = await sequelize.query(insertTicketQuery, {
      replacements: { userId: testUser.id },
      type: QueryTypes.INSERT
    });

    const newTicket = ticketResult[0][0];
    console.log('✅ Ticket de prueba creado:', newTicket);

    // 4. Agregar un mensaje al ticket
    console.log(`💬 Enviando mensaje de prueba al ticket ${newTicket.id}...`);
    const insertMsgQuery = `
      INSERT INTO ticket_mensajes (ticket_id, remitente_id, mensaje)
      VALUES (:ticketId, :userId, 'Hola, requiero soporte urgente con mi última reserva.')
      RETURNING id, mensaje, fecha_envio;
    `;
    const msgResult = await sequelize.query(insertMsgQuery, {
      replacements: { ticketId: newTicket.id, userId: testUser.id },
      type: QueryTypes.INSERT
    });

    console.log('✅ Mensaje de prueba creado:', msgResult[0][0]);

    // 5. Limpieza (borrar el ticket de prueba)
    console.log('🧹 Limpiando base de datos (eliminando ticket de prueba)...');
    await sequelize.query('DELETE FROM tickets WHERE id = :ticketId;', {
      replacements: { ticketId: newTicket.id },
      type: QueryTypes.DELETE
    });
    console.log('✅ Base de datos limpia.');
    console.log('🎉 ¡Todas las pruebas de base de datos de soporte pasaron exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ERROR DURANTE LA PRUEBA:', error);
    process.exit(1);
  }
}

testTickets();

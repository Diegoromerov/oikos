const { pool } = require('../config/db');

/**
 * Realiza la dispersión de fondos simulada de forma asíncrona usando Nequi a través de Wompi.
 * @param {string} bookingId ID de la cita.
 * @param {number} amount Monto neto a transferir al prestador.
 * @param {string} nequiNumber Número telefónico / Nequi del prestador.
 * @param {string} documentId Cédula / Identidad del titular.
 */
exports.disbursePayout = async (bookingId, amount, nequiNumber, documentId) => {
  // Desacoplado: Ejecutar en segundo plano simulando la latencia de red de la API de Wompi (1.5s)
  setTimeout(async () => {
    try {
      console.log(`\n💸 [WOMPI PAYOUT] Iniciando dispersión automática:`);
      console.log(`   - Cita ID: ${bookingId}`);
      console.log(`   - Monto Neto: $${amount} COP`);
      console.log(`   - Cuenta Nequi: ${nequiNumber}`);
      console.log(`   - Cédula Titular: ${documentId}`);

      if (!nequiNumber) {
        throw new Error('El prestador no tiene configurado un número de cuenta Nequi.');
      }

      // Simular llamada exitosa de Wompi y generar una referencia aleatoria
      const referenceToken = 'wompi_ref_' + Math.random().toString(36).substring(2, 11).toUpperCase();

      // Guardar registro de la transferencia en la tabla transactions
      const query = `
        INSERT INTO transactions (booking_id, amount, status, payment_method, external_id)
        VALUES ($1, $2, 'paid', 'NEQUI', $3)
        ON CONFLICT (booking_id) 
        DO UPDATE SET 
          amount = EXCLUDED.amount,
          status = 'paid', 
          payment_method = 'NEQUI',
          external_id = EXCLUDED.external_id;
      `;
      await pool.query(query, [bookingId, amount, referenceToken]);

      console.log(`✅ [WOMPI PAYOUT] Dispersión completada con éxito. Referencia: ${referenceToken} guardada en BD.`);
    } catch (err) {
      console.error(`❌ [WOMPI PAYOUT ERROR] Error al realizar el pago para la cita ${bookingId}:`, err.message);
      
      // Intentar guardar la transacción como fallida para auditoría
      try {
        const queryFailed = `
          INSERT INTO transactions (booking_id, amount, status, payment_method)
          VALUES ($1, $2, 'failed', 'NEQUI')
          ON CONFLICT (booking_id) 
          DO UPDATE SET status = 'failed';
        `;
        await pool.query(queryFailed, [bookingId, amount]);
      } catch (dbErr) {
        console.error(`❌ [WOMPI PAYOUT ERROR] No se pudo guardar estado de fallo en la BD:`, dbErr.message);
      }
    }
  }, 1500);
};

/**
 * Realiza un retiro / payout automático o por demanda a través de Wompi.
 * @param {object} params Datos del retiro
 */
exports.crearPayout = async ({ retiroId, providerId, amount, numeroCuenta, banco, automatico = false }) => {
  // Simular la llamada de Wompi con latencia
  setTimeout(async () => {
    try {
      console.log(`\n💸 [WOMPI PAYOUT RETIRO] Procesando dispersión de retiro (${automatico ? 'AUTOMÁTICO' : 'DEMANDA'}):`);
      console.log(`   - Retiro ID: ${retiroId}`);
      console.log(`   - Prestador ID: ${providerId}`);
      console.log(`   - Monto: $${amount} COP`);
      console.log(`   - Banco/Método: ${banco}`);
      console.log(`   - Cuenta: ${numeroCuenta}`);

      const referenceToken = 'wompi_ret_' + Math.random().toString(36).substring(2, 11).toUpperCase();

      // Actualizar el estado del retiro a COMPLETADO y guardar el ID externo
      await pool.query(
        `UPDATE retiros 
         SET estado = 'COMPLETADO', 
             referencia_wompi = $2,
             procesado_at = NOW() 
         WHERE id = $1`,
        [retiroId, referenceToken]
      );

      // Actualizar el estado de la transacción en ledger a COMPLETADO
      await pool.query(
        `UPDATE wallet_transactions 
         SET estado = 'COMPLETADO', 
             metadata = metadata || $2::jsonb 
         WHERE provider_id = $1 
           AND tipo = 'DEBITO_RETIRO' 
           AND (metadata->>'retiro_id')::uuid = $3`,
        [providerId, JSON.stringify({ referencia_wompi: referenceToken }), retiroId]
      );

      console.log(`✅ [WOMPI PAYOUT RETIRO] Retiro ${retiroId} dispersado con éxito. Ref: ${referenceToken}`);
    } catch (err) {
      console.error(`❌ [WOMPI PAYOUT RETIRO ERROR] Fallo al dispersar retiro ${retiroId}:`, err.message);
      await pool.query(
        `UPDATE retiros 
         SET estado = 'FALLIDO', 
             error_wompi = $2,
             procesado_at = NOW() 
         WHERE id = $1`,
        [retiroId, err.message]
      );
      await pool.query(
        `UPDATE wallet_transactions 
         SET estado = 'FALLIDO' 
         WHERE provider_id = $1 
           AND tipo = 'DEBITO_RETIRO' 
           AND (metadata->>'retiro_id')::uuid = $2`,
        [providerId, retiroId]
      );
    }
  }, 1000);
};


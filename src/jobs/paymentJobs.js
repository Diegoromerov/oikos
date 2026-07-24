// backend/src/jobs/paymentJobs.js
// Jobs programados: retiros automáticos (quincena/mensual) + conciliación diaria

const { pool } = require('../config/db');
const wompiService = require('../services/wompiService');
const { aplicarPricingDinamico } = require('./dynamicPricing');
const { enviarNotificacionesRetencion } = require('./retentionNotification');

/**
 * Lee un parámetro de configuración de la plataforma.
 */
async function getConfig(key, defaultValue = null) {
  const { rows } = await pool.query(
    'SELECT value FROM platform_config WHERE key = $1', [key]
  );
  return rows.length > 0 ? rows[0].value : defaultValue;
}

// ─── JOB 1: MADURACIÓN DE SALDOS PENDIENTES ──────────────────────────────────
/**
 * Mueve saldos de 'pendiente' a 'disponible' cuando su ventana de espera ha vencido.
 * Ejecutar cada 15 minutos.
 */
async function madurarSaldosPendientes() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener transacciones pendientes que ya maduraron
    const { rows: pendientes } = await client.query(`
      SELECT wt.provider_id, SUM(wt.monto) as total_a_madurar
      FROM wallet_transactions wt
      WHERE wt.tipo = 'CREDITO_SERVICIO'
        AND wt.estado = 'PENDIENTE'
        AND (wt.metadata->>'madura_at')::timestamptz <= NOW()
        AND (wt.metadata->>'acreditado') IS NULL
      GROUP BY wt.provider_id
    `);

    for (const row of pendientes) {
      // Acreditar al saldo disponible
      await client.query(
        `UPDATE provider_wallet
         SET saldo_disponible = saldo_disponible + $2,
             saldo_pendiente  = GREATEST(0, saldo_pendiente - $2),
             updated_at       = NOW()
         WHERE provider_id = $1`,
        [row.provider_id, parseFloat(row.total_a_madurar)]
      );

      // Marcar como completadas y acreditadas
      await client.query(
        `UPDATE wallet_transactions
         SET estado  = 'COMPLETADO',
             metadata = metadata || '{"acreditado": true}'::jsonb
         WHERE tipo = 'CREDITO_SERVICIO'
           AND estado = 'PENDIENTE'
           AND provider_id = $1
           AND (metadata->>'madura_at')::timestamptz <= NOW()
           AND (metadata->>'acreditado') IS NULL`,
        [row.provider_id]
      );

      console.log(`💰 Saldo madurado para prestador ${row.provider_id}: $${row.total_a_madurar}`);
    }

    await client.query('COMMIT');
    console.log(`✅ Job maduración completado. ${pendientes.length} prestadores actualizados.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en job de maduración:', err);
  } finally {
    client.release();
  }
}

// ─── JOB 2: RETIROS AUTOMÁTICOS (QUINCENA / MENSUAL) ─────────────────────────
/**
 * Ejecuta retiros automáticos para prestadores con modelo QUINCENA o MENSUAL.
 * Ejecutar diariamente a las 6:00 AM.
 */
async function ejecutarRetirosAutomaticos() {
  const client = await pool.connect();
  try {
    const minCop = parseInt(await getConfig('retiro_auto_min_cop', '20000'));

    // Buscar prestadores cuyo retiro automático está programado para hoy y cumplen regulaciones
    const { rows: wallets } = await client.query(`
      SELECT pw.*, u.nombre as nombre_prestador
      FROM provider_wallet pw
      JOIN usuarios u ON pw.provider_id = u.id
      JOIN perfiles_prestador p ON pw.provider_id = p.id
      WHERE pw.modelo_retiro IN ('QUINCENA', 'MENSUAL')
        AND pw.proximo_retiro_auto <= NOW()
        AND pw.saldo_disponible >= $1
        AND pw.retiros_pausados = FALSE
        AND pw.cuenta_verificada = TRUE
        AND p.facturacion_electronica_configurada = TRUE
    `, [minCop]);

    console.log(`🔄 Retiros automáticos: ${wallets.length} prestador(es) en cola.`);

    for (const wallet of wallets) {
      try {
        await client.query('BEGIN');

        const monto = parseFloat(wallet.saldo_disponible);

        // Verificar disputas activas
        const { rows: disputas } = await client.query(`
          SELECT COUNT(*) FROM disputas d
          JOIN bookings b ON d.booking_id = b.id
          WHERE b.provider_id = $1 AND d.estado IN ('ABIERTA','EN_REVISION')
        `, [wallet.provider_id]);

        if (parseInt(disputas[0].count) > 0) {
          console.log(`⏸️  Retiro pausado para ${wallet.nombre_prestador}: tiene disputas activas.`);
          await client.query('ROLLBACK');
          continue;
        }

        // Calcular próximo retiro según el modelo
        const ahora = new Date();
        let proximoRetiro;
        if (wallet.modelo_retiro === 'QUINCENA') {
          const dia = ahora.getDate();
          if (dia < 15) {
            proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
          } else {
            proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
          }
        } else { // MENSUAL
          proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
        }

        // Registrar retiro
        const { rows: retiroRows } = await client.query(
          `INSERT INTO retiros (provider_id, wallet_id, monto, tipo_origen, numero_cuenta, banco, estado)
           VALUES ($1, $2, $3, $4, $5, $6, 'PROCESANDO')
           RETURNING *`,
          [wallet.provider_id, wallet.id, monto, wallet.modelo_retiro,
           wallet.numero_cuenta, wallet.banco]
        );

        // Debitar wallet
        await client.query(
          `UPDATE provider_wallet
           SET saldo_disponible     = 0,
               total_retirado       = total_retirado + $2,
               ultimo_retiro_at     = NOW(),
               proximo_retiro_auto  = $3,
               updated_at           = NOW()
           WHERE provider_id = $1`,
          [wallet.provider_id, monto, proximoRetiro]
        );

        // Ledger
        await client.query(
          `INSERT INTO wallet_transactions
             (provider_id, tipo, monto, saldo_resultante, estado, descripcion, metadata)
           VALUES ($1, 'DEBITO_RETIRO', $2, 0, 'PENDIENTE', $3, $4)`,
          [
            wallet.provider_id, monto,
            `Retiro automático ${wallet.modelo_retiro}`,
            JSON.stringify({ retiro_id: retiroRows[0].id, automatico: true })
          ]
        );

        // Llamar a la API de Payouts de Wompi para realizar la dispersión
        wompiService.crearPayout({
          retiroId: retiroRows[0].id,
          providerId: wallet.provider_id,
          amount: monto,
          numeroCuenta: wallet.numero_cuenta,
          banco: wallet.banco,
          automatico: true
        }).catch(err => console.error('Error asíncrono al iniciar dispersión de retiro automático:', err));

        await client.query('COMMIT');
        console.log(`✅ Retiro automático de $${monto} para ${wallet.nombre_prestador}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error en retiro de ${wallet.nombre_prestador}:`, err);
      }
    }
  } catch (err) {
    console.error('❌ Error en job de retiros automáticos:', err);
  } finally {
    client.release();
  }
}

// ─── JOB 3: CONCILIACIÓN DIARIA ───────────────────────────────────────────────
/**
 * Verifica que el balance interno coincida con el reportado por Wompi.
 * Ejecutar diariamente a las 2:00 AM.
 */
async function conciliacionDiaria() {
  const client = await pool.connect();
  try {
    console.log('🔍 Iniciando conciliación diaria...');

    const { rows } = await client.query(`
      SELECT
        (SELECT COALESCE(SUM(saldo_disponible + saldo_pendiente + saldo_en_disputa), 0)
         FROM provider_wallet)                    AS total_wallets,
        (SELECT COALESCE(SUM(monto), 0)
         FROM retiros WHERE estado = 'PENDIENTE') AS retiros_pendientes,
        (SELECT COALESCE(SUM(monto), 0)
         FROM wallet_transactions
         WHERE tipo IN ('CREDITO_SERVICIO') AND estado != 'REVERTIDO'
           AND DATE(created_at) = CURRENT_DATE)  AS creditos_hoy,
        (SELECT COUNT(*) FROM disputas
         WHERE estado IN ('ABIERTA','EN_REVISION')
           AND sla_limite_at < NOW())             AS disputas_sla_vencido
    `);

    const reporte = rows[0];
    console.log('📊 Reporte de conciliación:', reporte);

    // TODO: Comparar con balance real de Wompi via API
    // const balanceWompi = await wompiService.obtenerBalance();
    // if (Math.abs(balanceWompi - reporte.total_wallets) > 100) { ALERTA CRÍTICA }

    if (parseInt(reporte.disputas_sla_vencido) > 0) {
      console.error(`⚠️  ${reporte.disputas_sla_vencido} disputas con SLA vencido. Requiere atención inmediata.`);
      // TODO: Enviar email de alerta al admin
    }

    // Expirar OTPs vencidos
    const { rows: expiredOTPs } = await client.query(
      `SELECT expirar_otps_vencidos() as expirados`
    );
    console.log(`⏱️  OTPs expirados: ${expiredOTPs[0].expirados}`);

    console.log('✅ Conciliación diaria completada.');
    return reporte;
  } catch (err) {
    console.error('❌ Error en conciliación diaria:', err);
  } finally {
    client.release();
  }
}

// ─── INICIALIZAR JOBS CON setInterval ─────────────────────────────────────────
/**
 * Configura los jobs periódicos usando setInterval (simple y sin dependencias).
 * Para producción, usar node-cron o un worker separado.
 */
function inicializarJobs() {
  console.log('⚙️  Iniciando jobs de pagos...');

  // Maduración de saldos: cada 15 minutos
  setInterval(madurarSaldosPendientes, 15 * 60 * 1000);

  // Retiros automáticos: cada día a las 6 AM (verificación cada hora)
  setInterval(async () => {
    const hora = new Date().getHours();
    if (hora === 6) await ejecutarRetirosAutomaticos();
  }, 60 * 60 * 1000);

  // Conciliación diaria: a las 2 AM
  setInterval(async () => {
    const hora = new Date().getHours();
    if (hora === 2) await conciliacionDiaria();
  }, 60 * 60 * 1000);

  // Pricing dinámico: cada día a las 3 AM
  setInterval(async () => {
    const hora = new Date().getHours();
    if (hora === 3) await aplicarPricingDinamico();
  }, 60 * 60 * 1000);

  // Notificaciones de retención: cada día a las 10 AM
  setInterval(async () => {
    const hora = new Date().getHours();
    if (hora === 10) await enviarNotificacionesRetencion();
  }, 60 * 60 * 1000);

  // Ejecutar maduración inmediatamente al iniciar
  setTimeout(madurarSaldosPendientes, 5000);
  
  console.log('✅ Jobs de pagos inicializados.');
}

module.exports = {
  inicializarJobs,
  madurarSaldosPendientes,
  ejecutarRetirosAutomaticos,
  conciliacionDiaria
};

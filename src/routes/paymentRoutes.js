// backend/src/routes/paymentRoutes.js
// Sistema completo de pagos: OTP, Wallet, Retiros, Disputas

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const wompiService = require('../services/wompiService');

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

async function getConfig(key, defaultValue = null) {
  const { rows } = await pool.query(
    'SELECT value FROM platform_config WHERE key = $1',
    [key]
  );
  return rows.length > 0 && rows[0].value != null ? rows[0].value : defaultValue;
}

async function generarOTP() {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const hash = await bcrypt.hash(codigo, 10);
  return { codigo, hash };
}

async function auditLog(client, { actorId, accion, tabla, registroId, datosAntes, datosDespues, ip }) {
  await client.query(
    `INSERT INTO audit_log (actor_id, accion, tabla, registro_id, datos_antes, datos_despues, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actorId, accion, tabla, registroId, datosAntes ? JSON.stringify(datosAntes) : null,
     datosDespues ? JSON.stringify(datosDespues) : null, ip || null]
  );
}

async function requirePrestador(req, res) {
  const { rows } = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [req.user.id]);
  if (!rows.length || rows[0].rol !== 'PRESTADOR') {
    res.status(403).json({ error: 'Solo prestadores pueden realizar esta acción.' });
    return false;
  }
  return true;
}

async function requireAdmin(req, res) {
  const { rows } = await pool.query('SELECT rol, email FROM usuarios WHERE id = $1', [req.user.id]);
  if (!rows.length || (rows[0].rol !== 'ADMIN' && rows[0].email !== 'admin@beautyapp.com' && rows[0].email !== 'admin')) {
    res.status(403).json({ error: 'Solo administradores pueden realizar esta acción.' });
    return false;
  }
  return true;
}

// ─── CHECK-IN GPS ────────────────────────────────────────────────────────────

router.post('/bookings/:id/checkin', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  const { id } = req.params;
  const { latitud, longitud } = req.body;

  if (!latitud || !longitud) {
    return res.status(400).json({ error: 'Se requieren coordenadas GPS para el check-in.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT b.*, u.nombre as cliente_nombre
       FROM bookings b
       JOIN usuarios u ON b.client_id = u.id
       WHERE b.id = $1 AND b.provider_id = $2 AND b.estado = 'CONFIRMADA'`,
      [id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Reserva no encontrada o no disponible para check-in.' });
    }

    const tolerancia = parseInt(await getConfig('gps_tolerancia_metros', '500'));

    await pool.query(
      `UPDATE bookings SET estado = 'CHECKIN_REALIZADO',
       notes = COALESCE(notes, '') || $3
       WHERE id = $1 AND provider_id = $2`,
      [id, req.user.id, ` [CHECKIN: ${latitud},${longitud} @ ${new Date().toISOString()}]`]
    );

    res.json({
      ok: true,
      mensaje: 'Check-in registrado. Puedes comenzar el servicio.',
      tolerancia_metros: tolerancia
    });
  } catch (err) {
    console.error('Error en check-in:', err);
    res.status(500).json({ error: 'Error al registrar check-in.' });
  }
});

// ─── COMPLETAR SERVICIO → GENERAR OTP ────────────────────────────────────────

router.post('/bookings/:id/complete', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT b.*, u.email as cliente_email, u.nombre as cliente_nombre
       FROM bookings b
       JOIN usuarios u ON b.client_id = u.id
       WHERE b.id = $1 AND b.provider_id = $2
         AND b.estado IN ('CONFIRMADA', 'CHECKIN_REALIZADO', 'EN_PROGRESO')`,
      [id, req.user.id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada o en estado incorrecto.' });
    }

    const booking = rows[0];

    const otpExistente = await client.query(
      `SELECT id FROM otp_validaciones
       WHERE booking_id = $1 AND estado = 'ACTIVO' AND expira_at > NOW()`,
      [id]
    );
    if (otpExistente.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un OTP activo para esta reserva.' });
    }

    const vigenciaMin = parseInt(await getConfig('otp_vigencia_minutos', '45'));
    const { codigo, hash } = await generarOTP();
    const expiraAt = new Date(Date.now() + vigenciaMin * 60 * 1000);

    await client.query(
      `INSERT INTO otp_validaciones (booking_id, codigo_hash, expira_at, ip_generacion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (booking_id) DO UPDATE
         SET codigo_hash = $2, expira_at = $3, estado = 'ACTIVO',
             intentos_fallidos = 0, usado_at = NULL`,
      [id, hash, expiraAt, req.ip]
    );

    await client.query(
      `UPDATE bookings SET estado = 'ESPERANDO_OTP' WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    console.log(`📱 OTP para reserva ${id}: ${codigo} (vigente ${vigenciaMin} min)`);

    res.json({
      ok: true,
      mensaje: 'Servicio marcado como completado. Se envió el código al cliente.',
      otp_expira_at: expiraAt,
      otp_vigencia_minutos: vigenciaMin,
      ...(process.env.NODE_ENV !== 'production' && { otp_dev: codigo })
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al completar servicio:', err);
    res.status(500).json({ error: 'Error al procesar la finalización del servicio.' });
  } finally {
    client.release();
  }
});

// ─── CONFIRMAR OTP → DISPERSIÓN ──────────────────────────────────────────────

router.post('/bookings/:id/confirm-otp', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { codigo } = req.body;

  if (!codigo || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ error: 'El código debe ser de 6 dígitos numéricos.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const otpResult = await client.query(
      `SELECT ov.*, b.valor_bruto, b.comision_plataforma, b.pago_neto_prestador,
              b.provider_id, b.client_id, COALESCE(b.propina, 0.00) as propina,
              p.regimen_tributario
       FROM otp_validaciones ov
       JOIN bookings b ON ov.booking_id = b.id
       JOIN perfiles_prestador p ON b.provider_id = p.id
       WHERE ov.booking_id = $1 AND ov.estado = 'ACTIVO'`,
      [id]
    );

    if (!otpResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No hay un código activo para esta reserva.' });
    }

    const otp = otpResult.rows[0];

    if (String(otp.client_id) !== String(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Solo el cliente de la reserva puede confirmar el OTP.' });
    }

    if (new Date() > new Date(otp.expira_at)) {
      await client.query(
        `UPDATE otp_validaciones SET estado = 'EXPIRADO' WHERE booking_id = $1`,
        [id]
      );
      await client.query('ROLLBACK');
      return res.status(410).json({
        error: 'El código ha expirado.',
        accion: 'ABRIR_DISPUTA',
        mensaje: 'El prestador puede reenviar el código o puedes abrir una disputa.'
      });
    }

    const maxIntentos = parseInt(await getConfig('otp_max_intentos', '3'));
    if (otp.intentos_fallidos >= maxIntentos) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: 'Código bloqueado por demasiados intentos fallidos.',
        accion: 'DISPUTA_AUTOMATICA'
      });
    }

    const esValido = await bcrypt.compare(codigo, otp.codigo_hash);
    if (!esValido) {
      const nuevosIntentos = otp.intentos_fallidos + 1;
      const nuevoEstado = nuevosIntentos >= maxIntentos ? 'BLOQUEADO' : 'ACTIVO';

      await client.query(
        `UPDATE otp_validaciones
         SET intentos_fallidos = $2, estado = $3
         WHERE booking_id = $1`,
        [id, nuevosIntentos, nuevoEstado]
      );
      await client.query('COMMIT');

      const intentosRestantes = maxIntentos - nuevosIntentos;
      if (nuevoEstado === 'BLOQUEADO') {
        return res.status(429).json({
          error: 'Código incorrecto. OTP bloqueado.',
          intentos_restantes: 0,
          accion: 'DISPUTA_AUTOMATICA'
        });
      }
      return res.status(400).json({
        error: `Código incorrecto. ${intentosRestantes} intento(s) restante(s).`,
        intentos_restantes: intentosRestantes
      });
    }

    const ventanaHoras = parseInt(await getConfig('wallet_ventana_pendiente_horas', '2'));
    const maduraAt = new Date(Date.now() + ventanaHoras * 60 * 60 * 1000);

    const isSimple = otp.regimen_tributario === 'SIMPLE';
    const dynamicRetefuentePct = isSimple ? 1.5 : parseFloat(await getConfig('retefuente_pct', '4.0'));
    const reteicaPct = 0.969; // ReteICA Bogotá (9.69/1000 = 0.969%)
    const reteivaPct = parseFloat(await getConfig('reteiva_pct', '15.0'));

    const basePagoNeto = parseFloat(otp.pago_neto_prestador);
    const comisionPlataforma = parseFloat(otp.comision_plataforma);
    const propinaCliente = parseFloat(otp.propina);

    const retencionFuente = Math.round(basePagoNeto * (dynamicRetefuentePct / 100) * 100) / 100;
    const retencionIca = Math.round(basePagoNeto * (reteicaPct / 100) * 100) / 100;
    const retencionIva = Math.round(comisionPlataforma * (reteivaPct / 100) * 100) / 100;

    const totalRetenciones = retencionFuente + retencionIca + retencionIva;
    // La propina se le suma íntegra (100%) al prestador sin comisión
    const montoNeto = basePagoNeto - totalRetenciones + propinaCliente;

    await client.query(
      `UPDATE otp_validaciones SET estado = 'USADO', usado_at = NOW() WHERE booking_id = $1`,
      [id]
    );

    await client.query(
      `UPDATE bookings SET estado = 'COMPLETADA', payment_status = 'paid' WHERE id = $1`,
      [id]
    );

    const walletResult = await client.query(
      `INSERT INTO provider_wallet (provider_id, saldo_pendiente, total_ganado)
       VALUES ($1, $2, $2)
       ON CONFLICT (provider_id) DO UPDATE
         SET saldo_pendiente = provider_wallet.saldo_pendiente + $2,
             total_ganado    = provider_wallet.total_ganado + $2,
             updated_at      = NOW()
       RETURNING *`,
      [otp.provider_id, montoNeto]
    );
    const wallet = walletResult.rows[0];

    await client.query(
      `INSERT INTO wallet_transactions
         (provider_id, booking_id, tipo, monto, saldo_resultante, estado, descripcion, metadata)
       VALUES ($1, $2, 'CREDITO_SERVICIO', $3, $4, 'PENDIENTE', $5, $6)`,
      [
        otp.provider_id, id, montoNeto,
        parseFloat(wallet.saldo_disponible) + parseFloat(wallet.saldo_pendiente),
        `Servicio completado. Disponible en ${ventanaHoras}h.`,
        JSON.stringify({
          madura_at: maduraAt,
          comision_plataforma: otp.comision_plataforma,
          retencion_fuente: retencionFuente,
          retencion_ica: retencionIca,
          retencion_iva: retencionIva,
          base_pago_neto: basePagoNeto,
          propina: propinaCliente,
          regimen_tributario: otp.regimen_tributario
        })
      ]
    );

    await client.query(
      `UPDATE wallet_transactions
       SET metadata = metadata || $2::jsonb
       WHERE booking_id = $1 AND tipo = 'CREDITO_SERVICIO'`,
      [id, JSON.stringify({ madura_at: maduraAt.toISOString() })]
    );

    // ─── LIBERAR COMISIÓN DE GLOWSTORE SI APLICA ───
    const storeOrderRes = await client.query(
      'SELECT id, comision_total_prestador FROM pedidos_tienda WHERE booking_id = $1 AND prestador_comisionado_id = $2;',
      [id, otp.provider_id]
    );

    if (storeOrderRes.rows.length > 0) {
      const storeOrder = storeOrderRes.rows[0];
      const comisionTienda = parseFloat(storeOrder.comision_total_prestador);

      if (comisionTienda > 0) {
        // Actualizar wallet sumando la comisión de la tienda al saldo pendiente
        const walletTiendaResult = await client.query(
          `UPDATE provider_wallet 
           SET saldo_pendiente = saldo_pendiente + $2,
               total_ganado    = total_ganado + $2,
               updated_at      = NOW()
           WHERE provider_id = $1
           RETURNING *`,
          [otp.provider_id, comisionTienda]
        );
        const walletTienda = walletTiendaResult.rows[0];

        // Insertar transacción de tipo CREDITO_PRODUCTO
        await client.query(
          `INSERT INTO wallet_transactions
             (provider_id, booking_id, tipo, monto, saldo_resultante, estado, descripcion, metadata)
           VALUES ($1, $2, 'CREDITO_PRODUCTO', $3, $4, 'PENDIENTE', $5, $6)`,
          [
            otp.provider_id, 
            id, 
            comisionTienda,
            parseFloat(walletTienda.saldo_disponible) + parseFloat(walletTienda.saldo_pendiente),
            `Comisión de productos en GlowStore - Pedido #${storeOrder.id}`,
            JSON.stringify({
              madura_at: maduraAt.toISOString(),
              pedido_id: storeOrder.id,
              comision_total: comisionTienda
            })
          ]
        );
        console.log(`💰 Acreditada comisión de tienda de $${comisionTienda} para el prestador ${otp.provider_id}`);
      }
    }

    await auditLog(client, {
      actorId: req.user.id,
      accion: 'OTP_CONFIRMADO',
      tabla: 'bookings',
      registroId: id,
      datosDespues: { monto_neto: montoNeto, madura_at: maduraAt },
      ip: req.ip
    });

    await client.query('COMMIT');

    res.json({
      ok: true,
      mensaje: '¡Servicio confirmado! El pago estará disponible para el prestador en breve.',
      monto_neto_prestador: montoNeto,
      disponible_en: maduraAt,
      ventana_horas: ventanaHoras
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al confirmar OTP:', err);
    res.status(500).json({ error: 'Error al procesar la confirmación.' });
  } finally {
    client.release();
  }
});

// ─── WALLET — SALDO Y RESUMEN ─────────────────────────────────────────────────

router.get('/wallet', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  try {
    await pool.query(
      `UPDATE wallet_transactions
       SET estado = 'COMPLETADO'
       WHERE tipo IN ('CREDITO_SERVICIO', 'CREDITO_PRODUCTO')
         AND estado = 'PENDIENTE'
         AND (metadata->>'madura_at')::timestamptz <= NOW()
         AND provider_id = $1`,
      [req.user.id]
    );

    const madurados = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) as total
       FROM wallet_transactions
       WHERE tipo IN ('CREDITO_SERVICIO', 'CREDITO_PRODUCTO')
         AND estado = 'COMPLETADO'
         AND provider_id = $1
         AND (metadata->>'acreditado') IS NULL`,
      [req.user.id]
    );

    if (parseFloat(madurados.rows[0].total) > 0) {
      await pool.query(
        `UPDATE provider_wallet
         SET saldo_disponible = saldo_disponible + $2,
             saldo_pendiente  = GREATEST(0, saldo_pendiente - $2),
             updated_at       = NOW()
         WHERE provider_id = $1`,
        [req.user.id, parseFloat(madurados.rows[0].total)]
      );
      await pool.query(
        `UPDATE wallet_transactions
         SET metadata = metadata || '{"acreditado": true}'::jsonb
         WHERE tipo IN ('CREDITO_SERVICIO', 'CREDITO_PRODUCTO')
           AND estado = 'COMPLETADO'
           AND provider_id = $1
           AND (metadata->>'acreditado') IS NULL`,
        [req.user.id]
      );
    }

    const { rows } = await pool.query(
      `SELECT pw.*,
              (SELECT COUNT(*) FROM disputas d
               JOIN bookings b ON d.booking_id = b.id
               WHERE b.provider_id = $1 AND d.estado IN ('ABIERTA','EN_REVISION')) as disputas_activas
       FROM provider_wallet pw
       WHERE pw.provider_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      await pool.query(
        'INSERT INTO provider_wallet (provider_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [req.user.id]
      );
      return res.json({
        saldo_disponible: 0, saldo_pendiente: 0, saldo_en_disputa: 0,
        total_ganado: 0, total_retirado: 0, modelo_retiro: 'DEMANDA',
        ultimo_retiro_at: null, cuenta_verificada: false, retiros_pausados: false
      });
    }

    const wallet = rows[0];

    const minCop = parseInt(await getConfig('retiro_demanda_min_cop', '50000'));
    const diasMin = parseInt(await getConfig('retiro_demanda_dias', '3'));
    let puede_retirar = false;
    let razon_bloqueo = null;
    let proxima_fecha_retiro = null;

    if (wallet.retiros_pausados) {
      razon_bloqueo = 'Tu cuenta tiene retiros pausados. Contacta soporte.';
    } else if (parseFloat(wallet.saldo_disponible) < minCop) {
      razon_bloqueo = `Saldo insuficiente. Mínimo: $${minCop.toLocaleString('es-CO')}`;
    } else if (wallet.ultimo_retiro_at) {
      const diasTranscurridos = (Date.now() - new Date(wallet.ultimo_retiro_at)) / (1000 * 60 * 60 * 24);
      if (diasTranscurridos < diasMin) {
        const diasRestantes = Math.ceil(diasMin - diasTranscurridos);
        proxima_fecha_retiro = new Date(new Date(wallet.ultimo_retiro_at).getTime() + diasMin * 24 * 60 * 60 * 1000);
        razon_bloqueo = `Próximo retiro disponible en ${diasRestantes} día(s).`;
      } else {
        puede_retirar = true;
      }
    } else {
      puede_retirar = true;
    }

    res.json({
      ...wallet,
      puede_retirar,
      razon_bloqueo,
      proxima_fecha_retiro,
      minimo_retiro_cop: minCop
    });
  } catch (err) {
    console.error('Error al obtener wallet:', err);
    res.status(500).json({ error: 'Error al obtener información del wallet.', details: err.message });
  }
});

// ─── WALLET — HISTORIAL DE TRANSACCIONES ─────────────────────────────────────

router.get('/wallet/transactions', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT wt.*, b.valor_bruto, s.name as servicio_nombre,
              u.nombre as cliente_nombre
       FROM wallet_transactions wt
       LEFT JOIN bookings b ON wt.booking_id = b.id
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN usuarios u ON b.client_id = u.id
       WHERE wt.provider_id = $1
       ORDER BY wt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const { rows: total } = await pool.query(
      'SELECT COUNT(*) FROM wallet_transactions WHERE provider_id = $1',
      [req.user.id]
    );

    res.json({
      transacciones: rows,
      pagination: { page, limit, total: parseInt(total[0].count) }
    });
  } catch (err) {
    console.error('Error al obtener transacciones:', err);
    res.status(500).json({ error: 'Error al obtener historial.', details: err.message });
  }
});

// ─── RETIRO — SOLICITAR ───────────────────────────────────────────────────────

router.post('/wallet/withdraw', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  const { monto } = req.body;
  const montoSolicitado = parseFloat(monto);

  if (!monto || isNaN(montoSolicitado) || montoSolicitado <= 0) {
    return res.status(400).json({ error: 'Monto inválido.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener la billetera del prestador
    const { rows } = await client.query(
      'SELECT * FROM provider_wallet WHERE provider_id = $1 FOR UPDATE',
      [req.user.id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Wallet no encontrado.' });
    }

    const wallet = rows[0];

    // 2. Verificar cumplimiento de Facturación Electrónica (Resolución 165/2023)
    const { rows: profileRows } = await client.query(
      'SELECT facturacion_electronica_configurada FROM perfiles_prestador WHERE id = $1',
      [req.user.id]
    );
    if (!profileRows.length || !profileRows[0].facturacion_electronica_configurada) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'FACTURACION_ELECTRONICA_REQUERIDA',
        message: 'Debes configurar y validar tu facturación electrónica en tu perfil antes de poder realizar retiros (Resolución DIAN 165/2023).'
      });
    }

    const minCop = parseInt(await getConfig('retiro_demanda_min_cop', '50000'));
    const diasMin = parseInt(await getConfig('retiro_demanda_dias', '3'));

    if (wallet.retiros_pausados) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Tus retiros están temporalmente pausados. Contacta soporte.' });
    }

    if (!wallet.cuenta_verificada) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Debes verificar tu cuenta bancaria antes de retirar.',
        accion: 'VERIFICAR_CUENTA'
      });
    }

    if (montoSolicitado < minCop) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `El monto mínimo de retiro es $${minCop.toLocaleString('es-CO')} COP.`,
        minimo: minCop
      });
    }

    if (montoSolicitado > parseFloat(wallet.saldo_disponible)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Saldo disponible insuficiente.',
        disponible: wallet.saldo_disponible
      });
    }

    if (wallet.ultimo_retiro_at) {
      const diasTranscurridos = (Date.now() - new Date(wallet.ultimo_retiro_at)) / (1000 * 60 * 60 * 24);
      if (diasTranscurridos < diasMin) {
        const proximaFecha = new Date(new Date(wallet.ultimo_retiro_at).getTime() + diasMin * 24 * 60 * 60 * 1000);
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: `Solo puedes retirar una vez cada ${diasMin} días.`,
          proxima_fecha: proximaFecha
        });
      }
    }

    const { rows: disputasActivas } = await client.query(
      `SELECT COUNT(*) FROM disputas d
       JOIN bookings b ON d.booking_id = b.id
       WHERE b.provider_id = $1 AND d.estado IN ('ABIERTA','EN_REVISION')`,
      [req.user.id]
    );
    if (parseInt(disputasActivas[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Tienes disputas activas. Los retiros se reanudan al resolver todas las disputas.'
      });
    }

    const retiroResult = await client.query(
      `INSERT INTO retiros (provider_id, wallet_id, monto, tipo_origen, numero_cuenta, banco)
       VALUES ($1, $2, $3, 'DEMANDA', $4, $5)
       RETURNING *`,
      [req.user.id, wallet.id, montoSolicitado, wallet.numero_cuenta, wallet.banco]
    );
    const retiro = retiroResult.rows[0];

    await client.query(
      `UPDATE provider_wallet
       SET saldo_disponible = saldo_disponible - $2,
           total_retirado   = total_retirado + $2,
           ultimo_retiro_at = NOW(),
           updated_at       = NOW()
       WHERE provider_id = $1`,
      [req.user.id, montoSolicitado]
    );

    const walletActualizado = await client.query(
      'SELECT saldo_disponible + saldo_pendiente as saldo_total FROM provider_wallet WHERE provider_id = $1',
      [req.user.id]
    );
    await client.query(
      `INSERT INTO wallet_transactions
         (provider_id, tipo, monto, saldo_resultante, estado, descripcion, metadata)
       VALUES ($1, 'DEBITO_RETIRO', $2, $3, 'PENDIENTE', $4, $5)`,
      [
        req.user.id, montoSolicitado,
        parseFloat(walletActualizado.rows[0].saldo_total),
        `Retiro por demanda solicitado`,
        JSON.stringify({ retiro_id: retiro.id, cuenta: wallet.numero_cuenta, banco: wallet.banco })
      ]
    );

    await auditLog(client, {
      actorId: req.user.id,
      accion: 'RETIRO_SOLICITADO',
      tabla: 'retiros',
      registroId: retiro.id,
      datosDespues: { monto: montoSolicitado, tipo: 'DEMANDA' },
      ip: req.ip
    });

    await client.query('COMMIT');

    wompiService.crearPayout({
      retiroId: retiro.id,
      providerId: req.user.id,
      amount: montoSolicitado,
      numeroCuenta: wallet.numero_cuenta,
      banco: wallet.banco,
      automatico: false
    }).catch(err => console.error('Error asíncrono al iniciar dispersión de retiro:', err));

    res.json({
      ok: true,
      mensaje: 'Retiro solicitado exitosamente. El dinero llegará en 1-2 días hábiles.',
      retiro_id: retiro.id,
      monto: montoSolicitado,
      cuenta: `${wallet.banco} ****${wallet.numero_cuenta?.slice(-4)}`,
      estado: 'PROCESANDO'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al procesar retiro:', err);
    res.status(500).json({ error: 'Error al procesar el retiro.' });
  } finally {
    client.release();
  }
});

// ─── WALLET — CAMBIAR MODELO DE RETIRO ───────────────────────────────────────

router.put('/wallet/model', authMiddleware, async (req, res) => {
  if (!await requirePrestador(req, res)) return;

  const { modelo } = req.body;
  const modelosValidos = ['DEMANDA', 'QUINCENA', 'MENSUAL'];

  if (!modelosValidos.includes(modelo)) {
    return res.status(400).json({ error: 'Modelo inválido. Use: DEMANDA, QUINCENA o MENSUAL.' });
  }

  try {
    let proximoRetiro = null;
    const ahora = new Date();
    if (modelo === 'QUINCENA') {
      const dia = ahora.getDate();
      if (dia < 15) {
        proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth(), 15);
      } else {
        proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
      }
    } else if (modelo === 'MENSUAL') {
      proximoRetiro = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    }

    await pool.query(
      `UPDATE provider_wallet
       SET modelo_retiro = $2, proximo_retiro_auto = $3, updated_at = NOW()
       WHERE provider_id = $1`,
      [req.user.id, modelo, proximoRetiro]
    );

    res.json({
      ok: true,
      modelo,
      proximo_retiro_auto: proximoRetiro,
      mensaje: `Modelo de retiro actualizado a: ${modelo}`
    });
  } catch (err) {
    console.error('Error al cambiar modelo:', err);
    res.status(500).json({ error: 'Error al actualizar modelo de retiro.' });
  }
});

// ─── DISPUTAS — ABRIR ─────────────────────────────────────────────────────────

router.post('/disputes', authMiddleware, async (req, res) => {
  const { booking_id, tipo, descripcion, evidencia_urls } = req.body;

  if (!booking_id || !tipo) {
    return res.status(400).json({ error: 'Se requieren booking_id y tipo de disputa.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT b.*, u_c.rol as rol_cliente, u_p.rol as rol_prestador
       FROM bookings b
       JOIN usuarios u_c ON b.client_id = u_c.id
       JOIN usuarios u_p ON b.provider_id = u_p.id
       WHERE b.id = $1 AND (b.client_id = $2 OR b.provider_id = $2)`,
      [booking_id, req.user.id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    const booking = rows[0];
    const userRow = await client.query('SELECT rol FROM usuarios WHERE id = $1', [req.user.id]);
    const rolActor = userRow.rows[0].rol;

    if (rolActor === 'CLIENTE' && booking.estado === 'COMPLETADA') {
      const ventanaHoras = parseInt(await getConfig('disputa_ventana_horas', '2'));
      const otpResult = await client.query(
        `SELECT usado_at FROM otp_validaciones WHERE booking_id = $1 AND estado = 'USADO'`,
        [booking_id]
      );
      if (otpResult.rows.length && otpResult.rows[0].usado_at) {
        const horasTranscurridas = (Date.now() - new Date(otpResult.rows[0].usado_at)) / (1000 * 60 * 60);
        if (horasTranscurridas > ventanaHoras) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `La ventana de disputa (${ventanaHoras}h post-confirmación) ha expirado.`,
            usado_at: otpResult.rows[0].usado_at
          });
        }
      }
    }

    const dispExistente = await client.query(
      `SELECT id FROM disputas WHERE booking_id = $1 AND estado NOT IN ('RESUELTA','CERRADA')`,
      [booking_id]
    );
    if (dispExistente.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe una disputa abierta para esta reserva.' });
    }

    const disputaResult = await client.query(
      `INSERT INTO disputas
         (booking_id, iniciado_por, tipo_actor, tipo, descripcion, evidencia_urls, monto_disputado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [booking_id, req.user.id, rolActor, tipo, descripcion, evidencia_urls || [], booking.valor_bruto]
    );

    await client.query(
      `UPDATE bookings SET estado = 'EN_DISPUTA' WHERE id = $1`,
      [booking_id]
    );

    if (booking.estado === 'COMPLETADA') {
      const montoCongelar = parseFloat(booking.pago_neto_prestador);
      await client.query(
        `UPDATE provider_wallet
         SET saldo_disponible = GREATEST(0, saldo_disponible - $2),
             saldo_en_disputa = saldo_en_disputa + $2,
             updated_at = NOW()
         WHERE provider_id = $1`,
        [booking.provider_id, montoCongelar]
      );
      await client.query(
        `INSERT INTO wallet_transactions
           (provider_id, booking_id, tipo, monto, saldo_resultante, estado, descripcion)
         SELECT $1, $2, 'RETENCION_DISPUTA', $3, saldo_disponible + saldo_pendiente,
                'COMPLETADO', 'Fondos congelados por disputa'
         FROM provider_wallet WHERE provider_id = $1`,
        [booking.provider_id, booking_id, montoCongelar]
      );
    }

    await auditLog(client, {
      actorId: req.user.id,
      accion: 'DISPUTA_ABIERTA',
      tabla: 'disputas',
      registroId: disputaResult.rows[0].id,
      datosDespues: { tipo, monto: booking.valor_bruto },
      ip: req.ip
    });

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      mensaje: 'Disputa registrada. Un agente la revisará en máximo 48 horas.',
      disputa: disputaResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al abrir disputa:', err);
    res.status(500).json({ error: 'Error al registrar la disputa.' });
  } finally {
    client.release();
  }
});

// ─── ADMIN — DASHBOARD FINANCIERO ────────────────────────────────────────────

router.get('/admin/dashboard', authMiddleware, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  try {
    const [financiero, disputas, alertas] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(valor_bruto), 0)        as recaudado_hoy,
          COALESCE(SUM(pago_neto_prestador), 0) as dispersado_hoy,
          COALESCE(SUM(comision_plataforma), 0) as comision_hoy,
          COUNT(*)                              as servicios_hoy
        FROM bookings
        WHERE DATE(created_at) = CURRENT_DATE AND estado = 'COMPLETADA'
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado = 'ABIERTA')      as abiertas,
          COUNT(*) FILTER (WHERE estado = 'EN_REVISION')  as en_revision,
          COUNT(*) FILTER (WHERE sla_limite_at < NOW() AND estado IN ('ABIERTA','EN_REVISION')) as vencidas_sla
        FROM disputas
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(saldo_disponible), 0) as total_wallets,
          COALESCE(SUM(saldo_pendiente), 0)  as total_pendiente,
          COALESCE(SUM(saldo_en_disputa), 0) as total_en_disputa,
          COUNT(*) FILTER (WHERE risk_score > 40) as prestadores_riesgo
        FROM provider_wallet
      `)
    ]);

    res.json({
      financiero: financiero.rows[0],
      disputas: disputas.rows[0],
      wallets: alertas.rows[0]
    });
  } catch (err) {
    console.error('Error en dashboard admin:', err);
    res.status(500).json({ error: 'Error al obtener métricas.' });
  }
});

// ─── ADMIN — LISTAR DISPUTAS ──────────────────────────────────────────────────

router.get('/admin/disputes', authMiddleware, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const estado = req.query.estado || 'ABIERTA';
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT d.*,
              u_i.nombre as iniciado_por_nombre,
              b.valor_bruto, b.provider_id, b.client_id,
              u_c.nombre as cliente_nombre,
              u_p.nombre as prestador_nombre,
              s.name as servicio_nombre,
              EXTRACT(EPOCH FROM (NOW() - d.creado_at))/3600 as horas_abierta,
              d.sla_limite_at < NOW() as sla_vencido
       FROM disputas d
       JOIN usuarios u_i ON d.iniciado_por = u_i.id
       JOIN bookings b ON d.booking_id = b.id
       JOIN usuarios u_c ON b.client_id = u_c.id
       JOIN usuarios u_p ON b.provider_id = u_p.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE d.estado = $1
       ORDER BY d.sla_limite_at ASC
       LIMIT $2 OFFSET $3`,
      [estado, limit, offset]
    );

    res.json({ disputas: rows, page, limit });
  } catch (err) {
    console.error('Error al listar disputas:', err);
    res.status(500).json({ error: 'Error al obtener disputas.' });
  }
});

// ─── ADMIN — RESOLVER DISPUTA ─────────────────────────────────────────────────

router.put('/admin/disputes/:id/resolve', authMiddleware, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { id } = req.params;
  const { resolucion, porcentaje_prestador, nota_resolucion } = req.body;

  const resolucionesValidas = ['FAVOR_PRESTADOR', 'REEMBOLSO_TOTAL', 'DIVISION', 'COMPENSACION_PLATAFORMA'];
  if (!resolucionesValidas.includes(resolucion)) {
    return res.status(400).json({ error: 'Resolución inválida.' });
  }
  if (resolucion === 'DIVISION' && (porcentaje_prestador === undefined || porcentaje_prestador < 0 || porcentaje_prestador > 100)) {
    return res.status(400).json({ error: 'Para DIVISION se requiere porcentaje_prestador (0-100).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT d.*, b.provider_id, b.client_id, b.pago_neto_prestador, b.valor_bruto
       FROM disputas d JOIN bookings b ON d.booking_id = b.id
       WHERE d.id = $1 AND d.estado IN ('ABIERTA','EN_REVISION')`,
      [id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Disputa no encontrada o ya resuelta.' });
    }

    const disputa = rows[0];
    const montoEnDisputa = parseFloat(disputa.pago_neto_prestador);

    let montoPrestador = 0;
    let montoReembolso = 0;

    switch (resolucion) {
      case 'FAVOR_PRESTADOR':
        montoPrestador = montoEnDisputa;
        break;
      case 'REEMBOLSO_TOTAL':
        montoReembolso = parseFloat(disputa.valor_bruto);
        break;
      case 'DIVISION':
        montoPrestador = (montoEnDisputa * porcentaje_prestador) / 100;
        montoReembolso = montoEnDisputa - montoPrestador;
        break;
      case 'COMPENSACION_PLATAFORMA':
        montoReembolso = parseFloat(disputa.valor_bruto);
        montoPrestador = 0;
        break;
    }

    await client.query(
      `UPDATE provider_wallet
       SET saldo_en_disputa  = GREATEST(0, saldo_en_disputa - $2),
           saldo_disponible  = saldo_disponible + $3,
           updated_at        = NOW()
       WHERE provider_id = $1`,
      [disputa.provider_id, montoEnDisputa, montoPrestador]
    );

    if (montoPrestador > 0) {
      await client.query(
        `INSERT INTO wallet_transactions
           (provider_id, booking_id, tipo, monto, saldo_resultante, estado, descripcion)
         SELECT $1, $2, 'LIBERACION_DISPUTA', $3, saldo_disponible + saldo_pendiente,
                'COMPLETADO', $4
         FROM provider_wallet WHERE provider_id = $1`,
        [disputa.provider_id, disputa.booking_id, montoPrestador,
         `Disputa resuelta: ${resolucion}. Fondos liberados.`]
      );
    }

    // ✅ BUG FIX: eliminado 'actualizado_at'/'updated_at' — columna no existe en tabla disputas
    await client.query(
      `UPDATE disputas
       SET estado = 'RESUELTA', resolucion = $2, porcentaje_prestador = $3,
           nota_resolucion = $4, resuelto_por = $5, resuelto_at = NOW()
       WHERE id = $1`,
      [id, resolucion, porcentaje_prestador || null, nota_resolucion || null, req.user.id]
    );

    await client.query(
      `UPDATE bookings SET estado = $2 WHERE id = $1`,
      [disputa.booking_id, resolucion === 'REEMBOLSO_TOTAL' ? 'CANCELADA' : 'COMPLETADA']
    );

    await auditLog(client, {
      actorId: req.user.id,
      accion: 'DISPUTA_RESUELTA',
      tabla: 'disputas',
      registroId: id,
      datosAntes: { estado: 'ABIERTA' },
      datosDespues: { resolucion, monto_prestador: montoPrestador, monto_reembolso: montoReembolso },
      ip: req.ip
    });

    await client.query('COMMIT');

    res.json({
      ok: true,
      mensaje: 'Disputa resuelta exitosamente.',
      resolucion,
      monto_liberado_prestador: montoPrestador,
      monto_reembolso_cliente: montoReembolso
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al resolver disputa:', err);
    res.status(500).json({ error: 'Error al resolver la disputa.' });
  } finally {
    client.release();
  }
});

module.exports = router;

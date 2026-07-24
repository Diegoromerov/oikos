// backend/src/controllers/bookingController.js
const { pool } = require('../config/db');
const { Booking, Service, User, Transaction } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const crypto = require('crypto');

const verifyWompiSignature = (req) => {
  const secret = process.env.WOMPI_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️ ADVERTENCIA CRÍTICA: WOMPI_WEBHOOK_SECRET no está configurado. En producción y staging las solicitudes de webhook serán bloqueadas.');
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
      return false;
    }
    return true; // Permitir en desarrollo local sin configuración
  }

  const signature = req.header('x-wompi-signature') || req.header('x-signature');
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

// 🔹 CREAR RESERVA
exports.createBooking = async (req, res) => {
  try {
    const clientId = req.user.id;
    let { provider_id, service_id, service_ids, scheduled_at, service_address, notes, productos_adicionales } = req.body;

    if (!service_ids && service_id) {
      service_ids = [service_id];
    }

    if (!provider_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0 || !scheduled_at) {
      return res.status(400).json({ error: 'Faltan campos requeridos o formato inválido para service_ids' });
    }

    // Obtener y validar todos los servicios solicitados
    const services = await Service.findAll({
      where: {
        id: service_ids,
        provider_id
      }
    });

    if (services.length !== service_ids.length) {
      return res.status(404).json({ error: 'Uno o más servicios no fueron encontrados' });
    }

    // Ordenar los servicios en base al orden recibido en service_ids
    const servicesMap = {};
    services.forEach(s => { servicesMap[s.id] = s; });
    const orderedServices = service_ids.map(id => servicesMap[id]);

    const totalServicesPrice = orderedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);
    const totalDurationMinutes = orderedServices.reduce((sum, s) => sum + parseInt(s.duration_minutes), 0);

    let total_amount = totalServicesPrice;
    let cleanProductsList = [];

    // Validar y acumular productos adicionales
    if (productos_adicionales && Array.isArray(productos_adicionales) && productos_adicionales.length > 0) {
      for (const prodItem of productos_adicionales) {
        const { id, cantidad } = prodItem;
        const qty = parseInt(cantidad) || 1;

        const prodQuery = 'SELECT id, nombre, precio, stock FROM productos WHERE id = :productId;';
        const prodResults = await sequelize.query(prodQuery, {
          replacements: { productId: id },
          type: sequelize.QueryTypes.SELECT
        });

        if (prodResults.length === 0) {
          return res.status(404).json({ error: `Producto con ID ${id} no encontrado` });
        }

        const dbProd = prodResults[0];
        if (parseInt(dbProd.stock) < qty) {
          return res.status(400).json({ error: `Stock insuficiente para el producto: ${dbProd.nombre}` });
        }

        const prodPrice = parseFloat(dbProd.precio);
        total_amount += prodPrice * qty;

        cleanProductsList.push({
          id: dbProd.id,
          nombre: dbProd.nombre,
          precio: prodPrice,
          cantidad: qty
        });
      }
    }

    // 🔸 Validación de solapamiento de horarios (Collision Check de la duración acumulada)
    const newStart = new Date(scheduled_at);
    const newEnd = new Date(newStart.getTime() + totalDurationMinutes * 60 * 1000);
    
    // Filtrar citas del mismo día únicamente para optimizar el rendimiento
    const startOfDay = new Date(newStart.getTime());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(newStart.getTime());
    endOfDay.setHours(23, 59, 59, 999);

    const overlaps = await Booking.findAll({
      where: {
        provider_id,
        estado: { [Op.ne]: 'CANCELADA' },
        scheduled_at: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      include: [{
        model: Service,
        as: 'service',
        attributes: ['duration_minutes']
      }]
    });

    // Verificar solapamiento en el subconjunto filtrado
    for (const b of overlaps) {
      const bStart = new Date(b.scheduled_at);
      const bDuration = parseInt(b.service.duration_minutes);
      const bEnd = new Date(bStart.getTime() + bDuration * 60 * 1000);

      if (newStart.getTime() < bEnd.getTime() && newEnd.getTime() > bStart.getTime()) {
        return res.status(409).json({ error: 'El horario seleccionado ya está reservado o entra en conflicto con otra cita' });
      }
    }

    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    // Calcular tarifa_reserva basada en el costo real transaccional de Wompi ($900 COP + 2.89% + IVA 19% del fee)
    const feeFijo = 900;
    const feeVariable = total_amount * 0.0289;
    const feeTotal = feeFijo + feeVariable;
    const ivaFee = feeTotal * 0.19;
    const tarifaReserva = Math.round(feeTotal + ivaFee);

    // Crear las múltiples citas secuenciales en la base de datos dentro de una transacción
    const generatedIds = orderedServices.map(() => crypto.randomUUID());
    let currentScheduledTime = new Date(scheduled_at);
    const createdBookings = [];

    await sequelize.transaction(async (t) => {
      for (let i = 0; i < orderedServices.length; i++) {
        const currentService = orderedServices[i];
        const currentId = generatedIds[i];
        const isPrimary = (i === 0);
        const durationMinutes = parseInt(currentService.duration_minutes);

        const bookingProducts = isPrimary ? (cleanProductsList.length > 0 ? cleanProductsList : []) : [];
        const bookingBruto = isPrimary ? total_amount : 0;
        const bookingTarife = isPrimary ? tarifaReserva : 0;

        const metadata = {
          products: bookingProducts,
          linked_booking_ids: generatedIds.filter(id => id !== currentId),
          is_primary: isPrimary,
          primary_booking_id: generatedIds[0]
        };

        const booking = await Booking.create({
          id: currentId,
          client_id: clientId,
          provider_id,
          service_id: currentService.id,
          scheduled_at: new Date(currentScheduledTime),
          valor_bruto: bookingBruto,
          tarifa_reserva: bookingTarife,
          service_address: service_address || null,
          notes: notes || null,
          estado: 'PENDIENTE_PAGO',
          pin_verificacion: pin,
          productos_adicionales: metadata
        }, { transaction: t });

        createdBookings.push(booking);

        // Incrementar el tiempo de inicio para la siguiente cita
        currentScheduledTime = new Date(currentScheduledTime.getTime() + durationMinutes * 60 * 1000);
      }
    });

    const primaryBooking = createdBookings[0];
    console.log(`📅 Nuevas citas enlazadas creadas: [${generatedIds.join(', ')}] para usuario ${clientId} con PIN ${pin}.`);

    // Enviar SMS simulado y notificar vía WebSocket con alerta auditiva "GlowApp"
    try {
      const { rows: providerRows } = await pool.query('SELECT nombre, phone FROM usuarios WHERE id = $1', [provider_id]);
      if (providerRows.length > 0) {
        const provider = providerRows[0];
        const providerPhone = provider.phone || 'no-phone';
        const msgText = `¡Tienes una nueva reserva en GlowApp! Alerta auditiva: GlowApp`;
        
        console.log(`[SMS SENDER] Enviando SMS a ${providerPhone} (${provider.nombre}): "${msgText}"`);
        
        const { notifyProviderNewBooking } = require('../services/websocketService');
        notifyProviderNewBooking(provider_id, msgText);
      }
    } catch (notifyErr) {
      console.error('⚠️ Error al notificar al prestador de nueva cita:', notifyErr.message);
    }

    res.json({
      success: true,
      message: 'Citas reservadas exitosamente',
      booking_id: primaryBooking.id,
      pin_verificacion: pin,
      booking: primaryBooking,
      bookings: createdBookings
    });
  } catch (error) {
    console.error('❌ ERROR EN /api/bookings:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
};

// 🔹 Panel de Prestador: Obtener citas
exports.getProviderBookings = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ error: 'Acceso denegado: solo para proveedores' });
    }

    // Usamos pool para queries directas si son a tablas no mapeadas (o complejas), 
    // pero Sequelize es genial para obtener la estructura limpia.
    const query = `
      SELECT 
        b.id, b.scheduled_at, b.estado AS status, b.valor_bruto AS total_amount, 
        b.comision_plataforma AS platform_commission, b.impuestos_estado AS state_tax, b.pago_neto_prestador AS provider_net_amount,
        b.client_id, b.pin_verificacion, b.service_address,
        s.name as service_name, s.price,
        u.nombre as client_name, u.phone as client_phone,
        t.external_id AS wompi_reference, t.status AS payout_status
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN usuarios u ON b.client_id = u.id
      LEFT JOIN transactions t ON b.id = t.booking_id
      WHERE b.provider_id = $1
      ORDER BY b.scheduled_at ASC;
    `;
    
    const result = await pool.query(query, [req.user.id]);
    
    const formattedBookings = result.rows.map(row => ({
      id: row.id,
      client_id: row.client_id.toString(),
      scheduled_at: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      status: row.status,
      total_amount: parseFloat(row.total_amount) || 0,
      platform_commission: parseFloat(row.platform_commission) || 0,
      state_tax: parseFloat(row.state_tax) || 0,
      provider_net_amount: parseFloat(row.provider_net_amount) || 0,
      service_name: row.service_name,
      price: parseFloat(row.price) || 0,
      client_name: row.client_name,
      client_phone: row.client_phone,
      service_address: row.service_address || '',
      pin_verificacion: row.pin_verificacion || null,
      wompi_reference: row.wompi_reference || null,
      payout_status: row.payout_status || null
    }));
    
    res.json({ success: true, count: formattedBookings.length, data: formattedBookings });
    
  } catch (error) {
    console.error('❌ ERROR EN /api/bookings/provider:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error interno al cargar citas' });
  }
};

// 🔹 Actualizar estado de cita
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;
    const providerId = req.user.id;

    const mapStatusToDb = (status) => {
      const s = status.toUpperCase();
      if (s === 'PENDING' || s === 'PENDIENTE_PAGO') return 'PENDIENTE_PAGO';
      if (s === 'CONFIRMED' || s === 'CONFIRMADA') return 'CONFIRMADA';
      if (s === 'COMPLETED' || s === 'COMPLETADA') return 'COMPLETADA';
      if (s === 'CANCELLED' || s === 'CANCELADA') return 'CANCELADA';
      return s;
    };

    const dbStatus = mapStatusToDb(status);

    const validStatuses = ['PENDIENTE_PAGO', 'CONFIRMADA', 'EN_PROGRESO', 'FINALIZADA_PRESTADOR', 'COMPLETADA', 'CANCELADA'];
    if (!validStatuses.includes(dbStatus)) {
      return res.status(400).json({ error: `Estado inválido. Permitidos: ${validStatuses.join(', ')}` });
    }

    const booking = await Booking.findOne({
      where: { id: bookingId, provider_id: providerId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada o no te pertenece' });
    }

    booking.estado = dbStatus;
    await booking.save();

    console.log('✅ Cita actualizada a estado:', dbStatus);
    
    res.json({ 
      success: true, 
      booking: {
        id: booking.id,
        status: booking.estado
      } 
    });
    
  } catch (error) {
    console.error('❌ ERROR EN PATCH /api/bookings/:id/status:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

// 🔹 Historial de Citas del Cliente
exports.getClientBookings = async (req, res) => {
  try {
    const clientId = req.user.id;

    const query = `
      SELECT 
        b.id, b.scheduled_at, b.estado AS status, b.valor_bruto AS total_amount, b.service_address, b.notes, b.pin_verificacion,
        s.name as service_name, s.duration_minutes as service_duration,
        u_prov.nombre as provider_name,
        p.business_name as provider_business_name,
        u_prov.foto_url as provider_avatar_url,
        u_prov.phone as provider_phone,
        r.id as review_id, r.rating as review_rating, r.comment as review_comment
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN perfiles_prestador p ON b.provider_id = p.id
      JOIN usuarios u_prov ON p.id = u_prov.id
      LEFT JOIN reviews r ON b.id = r.booking_id
      WHERE b.client_id = $1
      ORDER BY b.scheduled_at DESC;
    `;
    
    const result = await pool.query(query, [clientId]);
    
    const formattedBookings = result.rows.map(row => ({
      id: row.id,
      scheduled_at: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
      status: row.status,
      total_amount: parseFloat(row.total_amount) || 0,
      service_address: row.service_address || '',
      notes: row.notes || '',
      pin_verificacion: row.pin_verificacion || null,
      service_name: row.service_name,
      service_duration: parseInt(row.service_duration) || 0,
      provider_name: row.provider_name,
      provider_business_name: row.provider_business_name || '',
      provider_avatar_url: row.provider_avatar_url || '',
      provider_phone: row.provider_phone || '',
      is_reviewed: row.review_id !== null,
      review: row.review_id ? {
        id: row.review_id,
        rating: parseInt(row.review_rating) || 0,
        comment: row.review_comment || ''
      } : null
    }));
    
    res.json({ success: true, count: formattedBookings.length, data: formattedBookings });
    
  } catch (error) {
    console.error('❌ ERROR EN /api/bookings/client:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error interno al cargar el historial de citas' });
  }
};

// 🔹 Cancelar cita por cliente
exports.cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const clientId = req.user.id;

    const booking = await Booking.findOne({
      where: { id: bookingId, client_id: clientId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada o no tienes permisos para cancelarla' });
    }

    if (booking.estado === 'CANCELADA') {
      return res.status(400).json({ error: 'La cita ya está cancelada' });
    }
    if (booking.estado === 'COMPLETADA') {
      return res.status(400).json({ error: 'No se puede cancelar una cita que ya ha sido completada' });
    }

    booking.estado = 'CANCELADA';
    await booking.save();

    console.log(`❌ Cita ${bookingId} cancelada por el cliente ${clientId}`);

    res.json({
      success: true,
      message: 'Cita cancelada exitosamente',
      booking: {
        id: booking.id,
        status: booking.estado
      }
    });

  } catch (error) {
    console.error('❌ ERROR EN PATCH /api/bookings/:id/cancel:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error interno al cancelar la cita' });
  }
};

// 🔹 Simular Pago con Wompi para una cita (Cliente) - REFACTORIZADO A SEQUELIZE TRANSACTIONS
exports.payBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const clientId = req.user.id;
    const { payment_method } = req.body;

    const method = (payment_method || 'NEQUI').toUpperCase();
    if (!['NEQUI', 'CARD'].includes(method)) {
      return res.status(400).json({ error: 'Método de pago inválido. Permitidos: NEQUI, CARD' });
    }

    const booking = await Booking.findOne({
      where: { id: bookingId, client_id: clientId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada o no tienes permisos para pagarla' });
    }

    if (booking.estado !== 'PENDIENTE_PAGO') {
      return res.status(400).json({ error: `La cita no se encuentra en estado PENDIENTE_PAGO. Estado actual: ${booking.estado}` });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const referenceToken = 'wompi_sim_' + Math.random().toString(36).substring(2, 11).toUpperCase();

    const result = await sequelize.transaction(async (t) => {
      // 1. Actualizar el estado de la cita
      booking.estado = 'CONFIRMADA';
      booking.payment_status = 'paid';
      await booking.save({ transaction: t });

      // Propagar a citas hijas enlazadas
      if (booking.productos_adicionales && Array.isArray(booking.productos_adicionales.linked_booking_ids)) {
        const linkedIds = booking.productos_adicionales.linked_booking_ids;
        if (linkedIds.length > 0) {
          await Booking.update(
            { estado: 'CONFIRMADA', payment_status: 'paid' },
            { where: { id: linkedIds }, transaction: t }
          );
        }
      }

      // Decrementar stock de productos con validación preventiva (FOR UPDATE)
      const productsList = Array.isArray(booking.productos_adicionales)
        ? booking.productos_adicionales
        : (booking.productos_adicionales && Array.isArray(booking.productos_adicionales.products)
            ? booking.productos_adicionales.products
            : []);

      if (productsList.length > 0) {
        for (const item of productsList) {
          const prodRes = await sequelize.query(
            'SELECT stock, nombre FROM productos WHERE id = :productId FOR UPDATE;',
            {
              replacements: { productId: item.id },
              type: sequelize.QueryTypes.SELECT,
              transaction: t
            }
          );
          if (prodRes.length === 0) {
            throw new Error(`Producto con ID ${item.id} no encontrado.`);
          }
          const currentStock = parseInt(prodRes[0].stock) || 0;
          if (currentStock < item.cantidad) {
            throw new Error(`Stock insuficiente para el producto: ${prodRes[0].nombre}. Disponible: ${currentStock}, Solicitado: ${item.cantidad}`);
          }
          await sequelize.query(
            'UPDATE productos SET stock = stock - :qty WHERE id = :productId;',
            {
              replacements: { qty: item.cantidad, productId: item.id },
              type: sequelize.QueryTypes.UPDATE,
              transaction: t
            }
          );
        }
      }

      // 2. Registrar la transacción
      const [tx, created] = await Transaction.findOrCreate({
        where: { booking_id: bookingId },
        defaults: {
          amount: booking.valor_bruto,
          status: 'paid',
          payment_method: method,
          external_id: referenceToken
        },
        transaction: t
      });

      if (!created) {
        tx.amount = booking.valor_bruto;
        tx.status = 'paid';
        tx.payment_method = method;
        tx.external_id = referenceToken;
        await tx.save({ transaction: t });
      }

      return {
        booking_id: bookingId,
        reference: referenceToken,
        amount: parseFloat(booking.valor_bruto),
        payment_method: method
      };
    });

    console.log(`\n💳 [WOMPI SIMULATOR SUCCESS] Pago completado con éxito de forma local. Cita: ${bookingId}. Referencia: ${referenceToken}`);

    res.json({
      success: true,
      message: 'Pago procesado y verificado con éxito por el simulador de Wompi',
      status: 'APPROVED',
      ...result
    });

  } catch (error) {
    console.error('❌ ERROR EN POST /api/bookings/:id/pay:', error);
    res.status(500).json({ error: 'Error interno al procesar el pago' });
  }
};

// 🔹 Webhook Simulado de Wompi - REFACTORIZADO A SEQUELIZE TRANSACTIONS
exports.wompiWebhook = async (req, res) => {
  try {
    if (!verifyWompiSignature(req)) {
      return res.status(401).json({ error: 'Firma de webhook invÃ¡lida.' });
    }

    const { event, data } = req.body;
    console.log('📡 [WOMPI WEBHOOK RECEIVED] Evento:', event);

    if (event === 'transaction.updated' && data && data.transaction) {
      const tx = data.transaction;
      const bookingId = tx.reference;
      const status = tx.status;
      const amount = tx.amount_in_cents / 100;
      const paymentMethod = tx.payment_method_type || 'NEQUI';
      const externalId = tx.id;

      if (status === 'APPROVED') {
        await sequelize.transaction(async (t) => {
          // Actualizar cita a CONFIRMADA
          await Booking.update(
            { estado: 'CONFIRMADA', payment_status: 'paid' },
            { where: { id: bookingId }, transaction: t }
          );

          // Obtener la cita y propagar a citas hijas vinculadas si existen
          const booking = await Booking.findByPk(bookingId, { transaction: t });
          if (booking && booking.productos_adicionales && Array.isArray(booking.productos_adicionales.linked_booking_ids)) {
            const linkedIds = booking.productos_adicionales.linked_booking_ids;
            if (linkedIds.length > 0) {
              await Booking.update(
                { estado: 'CONFIRMADA', payment_status: 'paid' },
                { where: { id: linkedIds }, transaction: t }
              );
            }
          }

          // Decrementar stock de productos con validación preventiva (FOR UPDATE)
          const productsList = booking && booking.productos_adicionales
            ? (Array.isArray(booking.productos_adicionales)
                ? booking.productos_adicionales
                : (Array.isArray(booking.productos_adicionales.products)
                    ? booking.productos_adicionales.products
                    : []))
            : [];

          if (productsList.length > 0) {
            for (const item of productsList) {
              const prodRes = await sequelize.query(
                'SELECT stock, nombre FROM productos WHERE id = :productId FOR UPDATE;',
                {
                  replacements: { productId: item.id },
                  type: sequelize.QueryTypes.SELECT,
                  transaction: t
                }
              );
              if (prodRes.length === 0) {
                throw new Error(`Producto con ID ${item.id} no encontrado.`);
              }
              const currentStock = parseInt(prodRes[0].stock) || 0;
              if (currentStock < item.cantidad) {
                throw new Error(`Stock insuficiente para el producto: ${prodRes[0].nombre}. Disponible: ${currentStock}, Solicitado: ${item.cantidad}`);
              }
              await sequelize.query(
                'UPDATE productos SET stock = stock - :qty WHERE id = :productId;',
                {
                  replacements: { qty: item.cantidad, productId: item.id },
                  type: sequelize.QueryTypes.UPDATE,
                  transaction: t
                }
              );
            }
          }

          // Registrar la transacción
          const [trans, created] = await Transaction.findOrCreate({
            where: { booking_id: bookingId },
            defaults: {
              amount: amount,
              status: 'paid',
              payment_method: paymentMethod,
              external_id: externalId
            },
            transaction: t
          });

          if (!created) {
            trans.status = 'paid';
            trans.external_id = externalId;
            await trans.save({ transaction: t });
          }
        });

        console.log(`✅ [WOMPI WEBHOOK SUCCESS] Cita ${bookingId} confirmada por webhook Sequelize.`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ ERROR EN /api/payments/wompi-webhook:', error);
    res.status(500).json({ error: 'Error al procesar el webhook' });
  }
};

// 🔹 Crear reseña para cita completada
exports.createReview = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const clientId = req.user.id;
    const { rating, comment } = req.body;

    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'La calificación debe ser un número entero entre 1 y 5' });
    }

    const booking = await Booking.findOne({
      where: { id: bookingId, client_id: clientId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada o no tienes permisos para calificarla' });
    }

    if (booking.estado !== 'COMPLETADA') {
      return res.status(400).json({ error: 'Solo puedes calificar citas que hayan sido completadas' });
    }

    const reviewCheck = await pool.query('SELECT id FROM reviews WHERE booking_id = $1', [bookingId]);
    if (reviewCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Esta cita ya ha sido calificada' });
    }

    const clientDb = await pool.connect();
    try {
      await clientDb.query('BEGIN');

      const insertReviewQuery = `
        INSERT INTO reviews (booking_id, client_id, provider_id, rating, comment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      await clientDb.query(insertReviewQuery, [bookingId, clientId, booking.provider_id, parsedRating, comment || null]);

      const statsQuery = 'SELECT AVG(rating) as avg_rating, COUNT(id) as count_rating FROM reviews WHERE provider_id = $1;';
      const statsRes = await clientDb.query(statsQuery, [booking.provider_id]);
      const avg = parseFloat(statsRes.rows[0].avg_rating) || 0.0;
      const count = parseInt(statsRes.rows[0].count_rating) || 0;

      const updateProviderQuery = 'UPDATE perfiles_prestador SET rating_avg = $1, rating_count = $2 WHERE id = $3;';
      await clientDb.query(updateProviderQuery, [avg, count, booking.provider_id]);

      await clientDb.query('COMMIT');

      res.json({
        success: true,
        message: 'Reseña publicada con éxito y reputación del proveedor actualizada',
        data: { rating_avg: avg, rating_count: count }
      });
    } catch (e) {
      await clientDb.query('ROLLBACK');
      throw e;
    } finally {
      clientDb.release();
    }

  } catch (error) {
    console.error('❌ ERROR EN POST /api/bookings/:id/review:', { message: error.message, code: error.code });
    res.status(500).json({ error: 'Error interno al guardar la reseña' });
  }
};

// 🔹 INICIAR SERVICIO
exports.startService = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const providerId = req.user.id;

    const booking = await Booking.findOne({
      where: { id: bookingId, provider_id: providerId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada o no tienes permisos para iniciarla' });
    }

    if (booking.estado !== 'CONFIRMADA') {
      return res.status(400).json({ error: `No se puede iniciar el servicio. El estado actual es ${booking.estado} (debe ser CONFIRMADA).` });
    }

    booking.estado = 'EN_PROGRESO';
    await booking.save();

    console.log(`🚀 Servicio iniciado para cita ${bookingId} por prestador ${providerId}`);

    res.json({
      success: true,
      message: 'Servicio iniciado con éxito',
      booking: {
        id: booking.id,
        status: booking.estado
      }
    });

  } catch (error) {
    console.error('❌ ERROR EN PATCH /api/bookings/:id/start:', error);
    res.status(500).json({ error: 'Error interno al iniciar el servicio' });
  }
};

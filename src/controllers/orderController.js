// backend/src/controllers/orderController.js
const { pool } = require('../config/db');

// POST /api/store/checkout → Crear un nuevo pedido
exports.createOrder = async (req, res) => {
  const compradorId = req.user.id;
  const userRole = req.user.role; // 'client', 'provider', 'admin'
  const { booking_id, nombre_entrega, direccion_entrega, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere una lista de productos (items)' });
  }
  if (!nombre_entrega || !direccion_entrega) {
    return res.status(400).json({ error: 'Se requiere nombre y dirección de entrega' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let prestadorComisionadoId = null;
    let tieneDescuentoReserva = false;

    // Si está asociado a una cita, validar
    if (booking_id) {
      if (userRole === 'provider') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Un prestador no puede asociar compras a una reserva' });
      }

      const bookingRes = await client.query(
        'SELECT id, provider_id, client_id FROM bookings WHERE id = $1;',
        [booking_id]
      );

      if (bookingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      const booking = bookingRes.rows[0];
      if (booking.client_id !== compradorId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No tienes acceso a esta reserva' });
      }

      prestadorComisionadoId = booking.provider_id;
      tieneDescuentoReserva = true;
    }

    let subtotal = 0;
    let comisionTotal = 0;
    const processedItems = [];

    // Validar productos y stock, calcular costos
    for (const item of items) {
      const { producto_id, cantidad } = item;
      if (!producto_id || !cantidad || cantidad <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ID de producto y cantidad válidos son obligatorios' });
      }

      // Obtener producto
      const prodRes = await client.query(
        'SELECT * FROM productos WHERE id = $1 FOR UPDATE;', // Bloqueo para concurrencia
        [producto_id]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto con ID ${producto_id} no encontrado` });
      }

      const product = prodRes.rows[0];

      // Validar stock
      if (product.stock < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}` });
      }

      // Validar visibilidad/acceso
      if (userRole === 'client' && product.tipo_visibilidad === 'INSUMO_PRESTADOR') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `No tienes acceso al producto ${product.nombre}` });
      }

      // Determinar precio unitario y comisión unitaria
      let precioUnitario = 0;
      let comisionUnitaria = 0;

      if (userRole === 'provider' || userRole === 'admin') {
        precioUnitario = parseFloat(product.precio_prestador);
        comisionUnitaria = 0;
      } else if (tieneDescuentoReserva) {
        precioUnitario = parseFloat(product.precio_con_reserva);
        comisionUnitaria = parseFloat(product.comision_prestador);
      } else {
        precioUnitario = parseFloat(product.precio_al_publico);
        comisionUnitaria = 0;
      }

      // Restar stock
      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2;',
        [cantidad, producto_id]
      );

      subtotal += precioUnitario * cantidad;
      comisionTotal += comisionUnitaria * cantidad;

      processedItems.push({
        producto_id,
        cantidad,
        precio_unitario_pagado: precioUnitario,
        comision_unitaria_prestador: comisionUnitaria,
        nombre: product.nombre
      });
    }

    // Calcular envío e IVA
    // Opción 1 de Open Questions: Envío gratis si se entrega en la cita.
    const costoEnvio = tieneDescuentoReserva ? 0.00 : 12000.00;
    const iva = subtotal * 0.19; // 19% IVA
    const total = subtotal + iva + costoEnvio;

    // Crear el registro de pedido
    const orderInsertRes = await client.query(
      `INSERT INTO pedidos_tienda 
        (comprador_id, rol_comprador, booking_id, prestador_comisionado_id, comision_total_prestador, subtotal, envio, iva, total, estado, nombre_entrega, direccion_entrega)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PAGADO', $10, $11)
       RETURNING *;`,
      [
        compradorId,
        userRole === 'provider' ? 'PRESTADOR' : 'CLIENTE',
        booking_id || null,
        prestadorComisionadoId,
        comisionTotal,
        subtotal,
        costoEnvio,
        iva,
        total,
        nombre_entrega,
        direccion_entrega
      ]
    );

    const order = orderInsertRes.rows[0];

    // Crear los detalles del pedido
    for (const pItem of processedItems) {
      await client.query(
        `INSERT INTO detalles_pedido_tienda 
          (pedido_id, producto_id, cantidad, precio_unitario_pagado, comision_unitaria_prestador)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          order.id,
          pItem.producto_id,
          pItem.cantidad,
          pItem.precio_unitario_pagado,
          pItem.comision_unitaria_prestador
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        order,
        items: processedItems
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR EN CHECKOUT DE TIENDA:', error);
    res.status(500).json({ error: 'Error al procesar el checkout' });
  } finally {
    client.release();
  }
};

// GET /api/store/orders → Obtener pedidos del usuario logueado
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = '';
    const params = [userId];

    if (userRole === 'provider') {
      // Un prestador ve sus compras y también las ventas que debe entregar
      query = `
        SELECT DISTINCT pt.* 
        FROM pedidos_tienda pt
        WHERE pt.comprador_id = $1 OR pt.prestador_comisionado_id = $1
        ORDER BY pt.creado_en DESC;
      `;
    } else if (userRole === 'admin') {
      // Admin ve todo
      query = `
        SELECT pt.* 
        FROM pedidos_tienda pt
        ORDER BY pt.creado_en DESC;
      `;
      // Limpiar params para admin ya que no filtra por ID de comprador por defecto
      params.pop();
    } else {
      // Cliente normal solo ve sus propias compras
      query = `
        SELECT pt.* 
        FROM pedidos_tienda pt
        WHERE pt.comprador_id = $1
        ORDER BY pt.creado_en DESC;
      `;
    }

    const { rows } = await pool.query(query, params);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('❌ ERROR EN GET /api/store/orders:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

// GET /api/store/orders/:id → Obtener detalle de un pedido específico
exports.getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Obtener cabecera
    const orderRes = await pool.query(
      'SELECT * FROM pedidos_tienda WHERE id = $1;',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const order = orderRes.rows[0];

    // Validar propiedad de visualización
    if (
      userRole !== 'admin' &&
      order.comprador_id !== userId &&
      order.prestador_comisionado_id !== userId
    ) {
      return res.status(403).json({ error: 'No autorizado para ver este pedido' });
    }

    // Obtener detalles
    const detailsRes = await pool.query(
      `SELECT dpt.*, p.nombre, p.imagen_url, p.tag_especialidad 
       FROM detalles_pedido_tienda dpt
       JOIN productos p ON dpt.producto_id = p.id
       WHERE dpt.pedido_id = $1;`,
      [orderId]
    );

    res.json({
      success: true,
      data: {
        order,
        items: detailsRes.rows
      }
    });
  } catch (error) {
    console.error('❌ ERROR EN GET /api/store/orders/:id:', error);
    res.status(500).json({ error: 'Error al obtener detalle del pedido' });
  }
};

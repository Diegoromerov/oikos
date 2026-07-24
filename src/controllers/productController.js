// backend/src/controllers/productController.js
const { pool } = require('../config/db');

// GET /api/products → Obtener catálogo de productos (filtrado por rol y tag)
exports.getProducts = async (req, res) => {
  try {
    const { tag } = req.query;
    const userRole = req.user ? req.user.role : 'client'; // 'client', 'provider', 'admin'

    let query = '';
    const params = [];

    if (userRole === 'provider' || userRole === 'admin') {
      // Prestador/Admin ve todo (Público e Insumo) a precio_prestador
      query = `
        SELECT id, nombre, descripcion, precio_prestador AS precio, stock, imagen_url, tag_especialidad, tipo_visibilidad
        FROM productos
      `;
    } else {
      // Cliente solo ve productos públicos
      query = `
        SELECT id, nombre, descripcion, precio_al_publico AS precio, precio_con_reserva, stock, imagen_url, tag_especialidad, tipo_visibilidad
        FROM productos
        WHERE tipo_visibilidad = 'PUBLICO'
      `;
    }

    if (tag) {
      if (userRole === 'provider' || userRole === 'admin') {
        query += ' WHERE tag_especialidad = $1';
      } else {
        query += ' AND tag_especialidad = $1';
      }
      params.push(tag);
    }

    query += ' ORDER BY id ASC;';

    const { rows } = await pool.query(query, params);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('❌ ERROR EN GET /api/products:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// GET /api/products/:id → Obtener producto específico por ID
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    const userRole = req.user ? req.user.role : 'client';

    const { rows } = await pool.query(
      'SELECT id, nombre, descripcion, precio_al_publico, precio_con_reserva, precio_prestador, comision_prestador, stock, imagen_url, tag_especialidad, tipo_visibilidad FROM productos WHERE id = $1;',
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const product = rows[0];

    // Verificar visibilidad por rol
    if (userRole === 'client' && product.tipo_visibilidad === 'INSUMO_PRESTADOR') {
      return res.status(403).json({ error: 'No tienes acceso a este producto' });
    }

    // Adaptar campos de retorno segun rol
    const responseData = {
      id: product.id,
      nombre: product.nombre,
      descripcion: product.descripcion,
      stock: product.stock,
      imagen_url: product.imagen_url,
      tag_especialidad: product.tag_especialidad,
      tipo_visibilidad: product.tipo_visibilidad
    };

    if (userRole === 'provider' || userRole === 'admin') {
      responseData.precio = parseFloat(product.precio_prestador);
    } else {
      responseData.precio = parseFloat(product.precio_al_publico);
      responseData.precio_con_reserva = parseFloat(product.precio_con_reserva);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ ERROR EN GET /api/products/:id:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// POST /api/admin/products → Cargar/crear nuevo producto (para el Dashboard)
exports.createProduct = async (req, res) => {
  try {
    // Validar rol del usuario logueado
    if (req.user.role !== 'admin' && req.user.role !== 'provider') {
      return res.status(403).json({ error: 'No autorizado para realizar esta acción' });
    }

    const { 
      nombre, 
      descripcion, 
      precio_al_publico, 
      precio_con_reserva, 
      precio_prestador, 
      comision_prestador, 
      stock, 
      imagen_url, 
      tag_especialidad,
      tipo_visibilidad
    } = req.body;

    if (!nombre || !tag_especialidad) {
      return res.status(400).json({ error: 'nombre y tag_especialidad son obligatorios' });
    }

    const query = `
      INSERT INTO productos (nombre, descripcion, precio_al_publico, precio_con_reserva, precio_prestador, comision_prestador, stock, imagen_url, tag_especialidad, tipo_visibilidad)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, nombre, descripcion, precio_al_publico, precio_con_reserva, precio_prestador, comision_prestador, stock, imagen_url, tag_especialidad, tipo_visibilidad;
    `;

    const { rows } = await pool.query(query, [
      nombre,
      descripcion || '',
      precio_al_publico || 0.00,
      precio_con_reserva || 0.00,
      precio_prestador || 0.00,
      comision_prestador || 0.00,
      stock || 0,
      imagen_url || '',
      tag_especialidad,
      tipo_visibilidad || 'PUBLICO'
    ]);

    res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ ERROR EN POST /api/admin/products:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// PUT /api/admin/products/:id → Actualizar producto existente (para el Dashboard)
exports.updateProduct = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'provider') {
      return res.status(403).json({ error: 'No autorizado para realizar esta acción' });
    }

    const productId = req.params.id;
    const { 
      nombre, 
      descripcion, 
      precio_al_publico, 
      precio_con_reserva, 
      precio_prestador, 
      comision_prestador, 
      stock, 
      imagen_url, 
      tag_especialidad,
      tipo_visibilidad
    } = req.body;

    if (!nombre || !tag_especialidad) {
      return res.status(400).json({ error: 'nombre y tag_especialidad son obligatorios' });
    }

    const query = `
      UPDATE productos 
      SET nombre = $1, descripcion = $2, precio_al_publico = $3, precio_con_reserva = $4, 
          precio_prestador = $5, comision_prestador = $6, stock = $7, imagen_url = $8, 
          tag_especialidad = $9, tipo_visibilidad = $10
      WHERE id = $11
      RETURNING id, nombre, descripcion, precio_al_publico, precio_con_reserva, precio_prestador, comision_prestador, stock, imagen_url, tag_especialidad, tipo_visibilidad;
    `;

    const { rows } = await pool.query(query, [
      nombre,
      descripcion || '',
      precio_al_publico || 0.00,
      precio_con_reserva || 0.00,
      precio_prestador || 0.00,
      comision_prestador || 0.00,
      stock || 0,
      imagen_url || '',
      tag_especialidad,
      tipo_visibilidad || 'PUBLICO',
      productId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ ERROR EN PUT /api/admin/products/:id:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// DELETE /api/admin/products/:id → Eliminar producto de la base de datos (para el Dashboard)
exports.deleteProduct = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'provider') {
      return res.status(403).json({ error: 'No autorizado para realizar esta acción' });
    }

    const productId = req.params.id;
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1;', [productId]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      success: true,
      message: 'Producto eliminado con éxito'
    });
  } catch (error) {
    console.error('❌ ERROR EN DELETE /api/admin/products/:id:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

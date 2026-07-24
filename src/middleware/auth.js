const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { getJwtSecret, toApiRole } = require('../config/jwt');

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  try {
    const verified = jwt.verify(token, getJwtSecret());
    
    // Consultar el rol actual del usuario en la base de datos para evitar JWT desactualizados
    const userRes = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [verified.id]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado en el sistema.' });
    }
    
    const dbRole = userRes.rows[0].rol;
    req.user = {
      id: verified.id,
      email: verified.email,
      role: toApiRole(dbRole)
    };
    
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token inválido o expirado.' });
  }
};


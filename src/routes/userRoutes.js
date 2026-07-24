const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET /profile - Obtener perfil del usuario autenticado
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id, nombre, email, telefono, avatar_url, rol,
        fecha_nacimiento, genero, ciudad, direccion,
        created_at, updated_at
      FROM usuarios
      WHERE id = $1`,
      [req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ user: rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

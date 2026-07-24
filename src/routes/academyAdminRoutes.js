// backend/src/routes/academyAdminRoutes.js
// Admin routes para gestión de Academia Glow
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware para verificar rol ADMIN
const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado. Token inválido.' });
    }
    const { rows } = await pool.query('SELECT rol, email FROM usuarios WHERE id = $1', [req.user.id]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }
    const user = rows[0];
    if (user.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    req.admin = { email: user.email };
    next();
  } catch (error) {
    console.error('Error en adminMiddleware:', error);
    res.status(500).json({ error: 'Error interno de autorización.' });
  }
};

// Aplicar middlewares a todas las rutas
router.use(authMiddleware, adminMiddleware);

// ============================================================
// CURSOS
// ============================================================

// GET /api/admin/academy/courses - Listar todos los cursos con stats
router.get('/courses', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM academy_modules m WHERE m.course_id = c.id) as modules_count,
        (SELECT COUNT(*) FROM academy_lessons l 
         JOIN academy_modules m ON l.module_id = m.id 
         WHERE m.course_id = c.id) as lessons_count,
        (SELECT COUNT(*) FROM academy_quizzes q WHERE q.course_id = c.id) as quizzes_count,
        (SELECT COUNT(*) FROM academy_certificates cert WHERE cert.course_id = c.id) as certificates_issued,
        (SELECT COUNT(DISTINCT p.provider_id) FROM academy_progress p
         JOIN academy_lessons l ON p.lesson_id = l.id
         JOIN academy_modules m ON l.module_id = m.id
         WHERE m.course_id = c.id) as enrolled_providers
      FROM academy_courses c
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar cursos admin:', err);
    res.status(500).json({ error: 'Error al obtener cursos.' });
  }
});

// POST /api/admin/academy/courses - Crear nuevo curso
router.post('/courses', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { title, description, category, badge_name } = req.body;
    
    if (!title || !description || !category || !badge_name) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: title, description, category, badge_name' });
    }
    
    const { rows } = await client.query(`
      INSERT INTO academy_courses (title, description, category, badge_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, description, category, badge_name]);
    
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear curso:', err);
    res.status(500).json({ error: 'Error al crear curso.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/academy/courses/:id - Obtener curso completo con módulos, lecciones y quizzes
router.get('/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    
    const courseRes = await pool.query('SELECT * FROM academy_courses WHERE id = $1', [courseId]);
    if (!courseRes.rows.length) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    
    const modulesRes = await pool.query(`
      SELECT * FROM academy_modules WHERE course_id = $1 ORDER BY sort_order ASC
    `, [courseId]);
    
    const lessonsRes = await pool.query(`
      SELECT l.*, m.title as module_title, m.sort_order as module_order
      FROM academy_lessons l
      JOIN academy_modules m ON l.module_id = m.id
      WHERE m.course_id = $1
      ORDER BY m.sort_order ASC, l.sort_order ASC
    `, [courseId]);
    
    const quizzesRes = await pool.query(`
      SELECT * FROM academy_quizzes WHERE course_id = $1
    `, [courseId]);
    
    res.json({
      course: courseRes.rows[0],
      modules: modulesRes.rows,
      lessons: lessonsRes.rows,
      quizzes: quizzesRes.rows
    });
  } catch (err) {
    console.error('Error al obtener curso admin:', err);
    res.status(500).json({ error: 'Error al obtener curso.' });
  }
});

// PUT /api/admin/academy/courses/:id - Actualizar curso
router.put('/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { title, description, category, badge_name } = req.body;
    
    const { rows } = await pool.query(`
      UPDATE academy_courses 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          badge_name = COALESCE($4, badge_name)
      WHERE id = $5
      RETURNING *
    `, [title, description, category, badge_name, courseId]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar curso:', err);
    res.status(500).json({ error: 'Error al actualizar curso.' });
  }
});

// DELETE /api/admin/academy/courses/:id - Eliminar curso (cascada)
router.delete('/courses/:id', async (req, res) => {
  try {
    const courseId = req.params.id;
    const { rowCount } = await pool.query('DELETE FROM academy_courses WHERE id = $1', [courseId]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    
    res.json({ success: true, message: 'Curso eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar curso:', err);
    res.status(500).json({ error: 'Error al eliminar curso.' });
  }
});

// ============================================================
// MÓDULOS
// ============================================================

// POST /api/admin/academy/courses/:courseId/modules - Crear módulo
router.post('/courses/:courseId/modules', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, sort_order } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'El título del módulo es obligatorio.' });
    }
    
    // Obtener el siguiente sort_order si no se proporciona
    let order = sort_order;
    if (order === undefined) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM academy_modules WHERE course_id = $1',
        [courseId]
      );
      order = rows[0].next_order;
    }
    
    const { rows } = await pool.query(`
      INSERT INTO academy_modules (course_id, title, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [courseId, title, order]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al crear módulo:', err);
    res.status(500).json({ error: 'Error al crear módulo.' });
  }
});

// PUT /api/admin/academy/modules/:id - Actualizar módulo
router.put('/modules/:id', async (req, res) => {
  try {
    const { title, sort_order } = req.body;
    
    const { rows } = await pool.query(`
      UPDATE academy_modules 
      SET title = COALESCE($1, title),
          sort_order = COALESCE($2, sort_order)
      WHERE id = $3
      RETURNING *
    `, [title, sort_order, req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar módulo:', err);
    res.status(500).json({ error: 'Error al actualizar módulo.' });
  }
});

// DELETE /api/admin/academy/modules/:id - Eliminar módulo
router.delete('/modules/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM academy_modules WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }
    
    res.json({ success: true, message: 'Módulo eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar módulo:', err);
    res.status(500).json({ error: 'Error al eliminar módulo.' });
  }
});

// POST /api/admin/academy/modules/reorder - Reordenar módulos
router.post('/modules/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { modules } = req.body; // [{ id, sort_order }, ...]
    
    for (const m of modules) {
      await client.query('UPDATE academy_modules SET sort_order = $1 WHERE id = $2', [m.sort_order, m.id]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al reordenar módulos:', err);
    res.status(500).json({ error: 'Error al reordenar módulos.' });
  } finally {
    client.release();
  }
});

// ============================================================
// LECCIONES
// ============================================================

// POST /api/admin/academy/modules/:moduleId/lessons - Crear lección
router.post('/modules/:moduleId/lessons', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { title, video_url, content_text, sort_order } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'El título de la lección es obligatorio.' });
    }
    
    let order = sort_order;
    if (order === undefined) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM academy_lessons WHERE module_id = $1',
        [moduleId]
      );
      order = rows[0].next_order;
    }
    
    const { rows } = await pool.query(`
      INSERT INTO academy_lessons (module_id, title, video_url, content_text, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [moduleId, title, video_url || null, content_text || null, order]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al crear lección:', err);
    res.status(500).json({ error: 'Error al crear lección.' });
  }
});

// PUT /api/admin/academy/lessons/:id - Actualizar lección
router.put('/lessons/:id', async (req, res) => {
  try {
    const { title, video_url, content_text, sort_order } = req.body;
    
    const { rows } = await pool.query(`
      UPDATE academy_lessons 
      SET title = COALESCE($1, title),
          video_url = COALESCE($2, video_url),
          content_text = COALESCE($3, content_text),
          sort_order = COALESCE($4, sort_order)
      WHERE id = $5
      RETURNING *
    `, [title, video_url, content_text, sort_order, req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar lección:', err);
    res.status(500).json({ error: 'Error al actualizar lección.' });
  }
});

// DELETE /api/admin/academy/lessons/:id - Eliminar lección
router.delete('/lessons/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM academy_lessons WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }
    
    res.json({ success: true, message: 'Lección eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar lección:', err);
    res.status(500).json({ error: 'Error al eliminar lección.' });
  }
});

// POST /api/admin/academy/lessons/reorder - Reordenar lecciones
router.post('/lessons/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { lessons } = req.body; // [{ id, sort_order, module_id }, ...]
    
    for (const l of lessons) {
      await client.query('UPDATE academy_lessons SET sort_order = $1 WHERE id = $2', [l.sort_order, l.id]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al reordenar lecciones:', err);
    res.status(500).json({ error: 'Error al reordenar lecciones.' });
  } finally {
    client.release();
  }
});

// ============================================================
// QUIZZES
// ============================================================

// POST /api/admin/academy/courses/:courseId/quizzes - Crear pregunta de quiz
router.post('/courses/:courseId/quizzes', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { question, options, correct_index } = req.body;
    
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Se requiere pregunta y al menos 2 opciones.' });
    }
    if (correct_index === undefined || correct_index < 0 || correct_index >= options.length) {
      return res.status(400).json({ error: 'Índice de respuesta correcta inválido.' });
    }
    
    const { rows } = await pool.query(`
      INSERT INTO academy_quizzes (course_id, question, options, correct_index)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [courseId, question, JSON.stringify(options), correct_index]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error al crear quiz:', err);
    res.status(500).json({ error: 'Error al crear pregunta del examen.' });
  }
});

// PUT /api/admin/academy/quizzes/:id - Actualizar pregunta de quiz
router.put('/quizzes/:id', async (req, res) => {
  try {
    const { question, options, correct_index } = req.body;
    
    if (options && (!Array.isArray(options) || options.length < 2)) {
      return res.status(400).json({ error: 'Se requieren al menos 2 opciones.' });
    }
    if (correct_index !== undefined && options && (correct_index < 0 || correct_index >= options.length)) {
      return res.status(400).json({ error: 'Índice de respuesta correcta inválido.' });
    }
    
    const { rows } = await pool.query(`
      UPDATE academy_quizzes 
      SET question = COALESCE($1, question),
          options = COALESCE($2, options),
          correct_index = COALESCE($3, correct_index)
      WHERE id = $4
      RETURNING *
    `, [question, options ? JSON.stringify(options) : null, correct_index, req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar quiz:', err);
    res.status(500).json({ error: 'Error al actualizar pregunta.' });
  }
});

// DELETE /api/admin/academy/quizzes/:id - Eliminar pregunta de quiz
router.delete('/quizzes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM academy_quizzes WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    
    res.json({ success: true, message: 'Pregunta eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar quiz:', err);
    res.status(500).json({ error: 'Error al eliminar pregunta.' });
  }
});

// ============================================================
// ESTADÍSTICAS / ANALÍTICAS
// ============================================================

// GET /api/admin/academy/stats - Estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM academy_courses) as total_courses,
        (SELECT COUNT(*) FROM academy_modules) as total_modules,
        (SELECT COUNT(*) FROM academy_lessons) as total_lessons,
        (SELECT COUNT(*) FROM academy_quizzes) as total_quizzes,
        (SELECT COUNT(*) FROM academy_certificates) as total_certificates,
        (SELECT COUNT(DISTINCT provider_id) FROM academy_progress) as active_learners,
        (SELECT COUNT(*) FROM academy_progress WHERE completed = true) as completed_lessons_total
    `);
    
    // Cursos más populares
    const popularRes = await pool.query(`
      SELECT c.id, c.title, c.badge_name,
        COUNT(DISTINCT p.provider_id) as enrolled_count,
        COUNT(CASE WHEN p.completed = true THEN 1 END) as completed_count
      FROM academy_courses c
      LEFT JOIN academy_modules m ON m.course_id = c.id
      LEFT JOIN academy_lessons l ON l.module_id = m.id
      LEFT JOIN academy_progress p ON p.lesson_id = l.id
      GROUP BY c.id
      ORDER BY enrolled_count DESC
      LIMIT 5
    `);
    
    // Certificados por curso
    const certsRes = await pool.query(`
      SELECT c.title, c.badge_name, COUNT(cert.*) as certificates_count
      FROM academy_certificates cert
      JOIN academy_courses c ON c.id = cert.course_id
      GROUP BY c.id
      ORDER BY certificates_count DESC
    `);
    
    res.json({
      overview: rows[0],
      popularCourses: popularRes.rows,
      certificatesByCourse: certsRes.rows
    });
  } catch (err) {
    console.error('Error al obtener stats academia:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

module.exports = router;
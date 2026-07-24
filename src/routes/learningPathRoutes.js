// backend/src/routes/learningPathRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

const LearningPath = require('../models/LearningPath');
const PathCourse = require('../models/PathCourse');
const Course = require('../models/academy_courses'); // Assuming existing model file name

// Get all learning paths
router.get('/', authMiddleware, async (req, res) => {
  try {
    const paths = await LearningPath.findAll();
    res.json(paths);
  } catch (err) {
    console.error('Error fetching learning paths:', err);
    res.status(500).json({ error: 'Error fetching learning paths' });
  }
});

// Get a specific learning path with its courses
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const path = await LearningPath.findByPk(id);
    if (!path) return res.status(404).json({ error: 'Learning path not found' });
    const courses = await PathCourse.findAll({ where: { path_id: id }, order: [['position', 'ASC']] });
    res.json({ path, courses });
  } catch (err) {
    console.error('Error fetching learning path:', err);
    res.status(500).json({ error: 'Error fetching learning path' });
  }
});

// Create a new learning path
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, level, estimated_hours, badge_id } = req.body;
  try {
    const newPath = await LearningPath.create({ name, description, level, estimated_hours, badge_id });
    res.status(201).json(newPath);
  } catch (err) {
    console.error('Error creating learning path:', err);
    res.status(500).json({ error: 'Error creating learning path' });
  }
});

// Add a course to a learning path (position & optional prerequisite)
router.post('/:id/courses', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { course_id, position, prerequisite_course_id } = req.body;
  try {
    const entry = await PathCourse.create({ path_id: id, course_id, position, prerequisite_course_id });
    res.status(201).json(entry);
  } catch (err) {
    console.error('Error adding course to path:', err);
    res.status(500).json({ error: 'Error adding course to learning path' });
  }
});

module.exports = router;

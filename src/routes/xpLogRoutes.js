// src/routes/xpLogRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const xpLogController = require('../controllers/xpLogController');
const Joi = require('joi');

// Validation schema for creating an XP log entry
const xpLogSchema = Joi.object({
  points: Joi.number().integer().required(),
  description: Joi.string().allow('').optional()
});

// Middleware to validate request body against a Joi schema
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
}


// Get XP logs for the authenticated user
router.get('/', authMiddleware, xpLogController.getLogs);

// Create a new XP log entry
router.post('/', authMiddleware, validate(xpLogSchema), xpLogController.createLog);

module.exports = router;

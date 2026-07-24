// src/routes/portfolioRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Joi = require('joi');

// Validation schema for creating a portfolio item
const portfolioSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  url: Joi.string().uri().optional()
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
const portfolioController = require('../controllers/portfolioController');

// List portfolio items for the authenticated user
router.get('/', authMiddleware, portfolioController.listItems);

// Create a new portfolio item
router.post('/', authMiddleware, validate(portfolioSchema), portfolioController.createItem);

module.exports = router;

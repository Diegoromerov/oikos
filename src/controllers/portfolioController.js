// src/controllers/portfolioController.js
const Joi = require('joi');
const { Portfolio } = require('../models');

// Validation schema for portfolio items (allow unknown fields)
const portfolioSchema = Joi.object({ title: Joi.string().required(), description: Joi.string().allow('').optional() }).unknown(true);

// List portfolio items for authenticated user
async function listItems(req, res) {
  try {
    const items = await Portfolio.findAll({ where: { user_id: req.user.id } });
    return res.json(items);
  } catch (err) {
    console.error('Error fetching portfolios:', err);
    return res.status(500).json({ error: 'Error fetching portfolios.' });
  }
}

// Create a new portfolio item
async function createItem(req, res) {
  try {
    // Validate request body
    const { error } = portfolioSchema.validate({ ...req.body, user_id: req.user.id });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const item = await Portfolio.create({ ...req.body, user_id: req.user.id });
    return res.status(201).json(item);
  } catch (err) {
    console.error('Error creating portfolio item:', err);
    return res.status(500).json({ error: 'Error creating portfolio item.' });
  }
}

module.exports = { listItems, createItem };

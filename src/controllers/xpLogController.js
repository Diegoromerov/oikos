// src/controllers/xpLogController.js
const { XpLog } = require('../models');
const Joi = require('joi');

// Validation schema for XP logs (allow unknown fields)
const xpLogSchema = Joi.object({ points: Joi.number().integer().required(), description: Joi.string().allow('').optional() }).unknown(true);

async function getLogs(req, res) {
  try {
    const logs = await XpLog.findAll({ where: { user_id: req.user.id } });
    return res.json(logs);
  } catch (err) {
    console.error('Error fetching XP logs:', err);
    return res.status(500).json({ error: 'Error fetching XP logs.' });
  }
}

// Create a new XP log entry
async function createLog(req, res) {
  try {
    // Validate request body
    const { error } = xpLogSchema.validate({ ...req.body, user_id: req.user.id });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const log = await XpLog.create({ ...req.body, user_id: req.user.id });
    return res.status(201).json(log);
  } catch (err) {
    console.error('Error creating XP log:', err);
    return res.status(500).json({ error: 'Error creating XP log.' });
  }
}

module.exports = { getLogs, createLog };

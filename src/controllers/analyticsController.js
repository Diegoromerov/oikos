// src/controllers/analyticsController.js
const { AnalyticsEvent } = require('../models');

// Log an analytics event (telemetry)
async function logEvent(req, res) {
  try {
    const evt = await AnalyticsEvent.create(req.body);
    return res.status(201).json(evt);
  } catch (err) {
    console.error('Error logging analytics event:', err);
    return res.status(500).json({ error: 'Error logging analytics event.' });
  }
}

module.exports = { logEvent };

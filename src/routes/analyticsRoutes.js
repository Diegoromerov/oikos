<<<<<<< HEAD
const express = require('express');
const router = express.Router();

// POST /api/analytics/events
router.post('/events', async (req, res) => {
  try {
    const { event, data, userId, timestamp } = req.body;
    
    // Aquí puedes guardar el evento en la base de datos
    // Por ahora solo retornamos éxito
    console.log('Analytics event received:', { event, data, userId, timestamp });
    
    res.status(200).json({ 
      success: true, 
      message: 'Event recorded' 
    });
  } catch (error) {
    console.error('Error recording analytics event:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error recording event' 
    });
  }
});
=======
// src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// Log analytics event (telemetry)
router.post('/events', authMiddleware, analyticsController.logEvent);
>>>>>>> a8652f67562fc0c649bb71ba89711c71c19c5826

module.exports = router;

// backend/src/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const serviceController = require('../controllers/serviceController');

router.get('/services/provider', authMiddleware, serviceController.getProviderServices);
router.post('/services', authMiddleware, serviceController.createService);
router.put('/services/:id', authMiddleware, serviceController.updateService);
router.delete('/services/:id', authMiddleware, serviceController.deleteService);

module.exports = router;

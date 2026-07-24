const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');

router.get('/providers', providerController.getProviders);
router.get('/providers/:id', providerController.getProviderById);
router.get('/providers/:id/slots', providerController.getProviderSlots);

module.exports = router;

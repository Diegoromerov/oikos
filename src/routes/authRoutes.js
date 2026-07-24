const express = require('express');
const router = express.Router();
const { register, login, oauth, onboarding, acceptBiometricsConsent } = require('../controllers/authController');
const { googleSignIn } = require('../controllers/oauthController');
const authMiddleware = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/oauth', oauth);
router.post('/google', googleSignIn);
router.patch('/onboarding', authMiddleware, onboarding);
router.patch('/biometrics/consent', authMiddleware, acceptBiometricsConsent);

module.exports = router;


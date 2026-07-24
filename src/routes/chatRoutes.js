// backend/src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const chatController = require('../controllers/chatController');
const rateLimiter = require('../middleware/rateLimiter');

router.get('/chat/conversations', authMiddleware, chatController.getConversations);
router.get('/chat/messages/:partnerId', authMiddleware, chatController.getMessages);
router.post('/chat/messages', authMiddleware, rateLimiter(), chatController.sendMessage);
router.patch('/chat/messages/:partnerId/read', authMiddleware, chatController.readMessages);

module.exports = router;

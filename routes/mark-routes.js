const express = require('express');
const MarkController = require('../controllers/mark-controller');

const router = express.Router();
const markController = new MarkController();

/**
 * 🐐 MARK ROUTES - AI Assistant API Endpoints 🐐
 * 
 * Dedicated routes for Mark's AI assistant functionality
 * Provides clean RESTful API for Mark interactions
 */

// Public endpoints (no authentication required)
router.get('/status', markController.getStatus);
router.get('/health', markController.getHealth);
router.get('/capabilities', markController.getCapabilities);
router.get('/test', markController.testAI);

// Chat endpoints (basic API key authentication)
router.post('/chat', markController.chat);
router.get('/stats', markController.getConversationStats);

// Admin endpoints (admin authentication required)
router.delete('/history', markController.clearHistory);
router.put('/config', markController.updateConfig);

module.exports = router;
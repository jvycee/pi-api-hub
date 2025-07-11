const express = require('express');
const Mark2Controller = require('../controllers/mark2-controller');

const router = express.Router();
const mark2Controller = new Mark2Controller();

/**
 * 🤖 MARK2 ROUTES - General Purpose AI Assistant API 🤖
 * 
 * Independent AI assistant routes for general-purpose conversations
 * Not tied to Pi API Hub infrastructure - completely standalone
 */

// Public endpoints (no authentication required)
router.get('/status', mark2Controller.getStatus);
router.get('/health', mark2Controller.getHealth);
router.get('/capabilities', mark2Controller.getCapabilities);
router.get('/modes', mark2Controller.getModes);
router.get('/conversation-starters', mark2Controller.getConversationStarters);
router.get('/test', mark2Controller.testAI);

// Chat endpoints (basic API key authentication)
router.post('/chat', mark2Controller.chat);
router.post('/mode', mark2Controller.setMode);
router.get('/stats', mark2Controller.getConversationStats);

// Admin endpoints (admin authentication required)
router.delete('/history', mark2Controller.clearHistory);
router.get('/export-history', mark2Controller.exportHistory);
router.put('/config', mark2Controller.updateConfig);

module.exports = router;
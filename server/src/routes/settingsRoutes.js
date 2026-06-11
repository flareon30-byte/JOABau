const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(checkRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.get('/gemini-key', settingsController.getGeminiKey);
router.post('/gemini-key', settingsController.saveGeminiKey);

module.exports = router;

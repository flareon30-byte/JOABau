const express = require('express');
const router = express.Router();
const dietaController = require('../controllers/dietaController');
const auth = require('../middleware/authMiddleware');

router.post('/log', auth.verifyToken, dietaController.logDieta);
router.get('/today', auth.verifyToken, dietaController.getTodayDieta);

module.exports = router;

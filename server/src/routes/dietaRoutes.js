const express = require('express');
const router = express.Router();
const dietaController = require('../controllers/dietaController');
const auth = require('../middleware/auth');

router.post('/log', auth, dietaController.logDieta);
router.get('/today', auth, dietaController.getTodayDieta);

module.exports = router;

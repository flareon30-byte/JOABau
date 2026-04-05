const express = require('express');
const router = express.Router();
const dietaController = require('../controllers/dietaController');
const auth = require('../middleware/authMiddleware');

router.post('/log', auth.verifyToken, dietaController.logDieta);
router.get('/today', auth.verifyToken, dietaController.getTodayDieta);
router.post('/admin/log', auth.verifyToken, auth.checkRole(['ADMIN', 'SUPER_ADMIN']), dietaController.adminLogDieta);

module.exports = router;

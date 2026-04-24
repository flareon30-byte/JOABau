const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/payroll', checkRole(['ADMIN', 'SUPER_ADMIN']), dashboardController.getPayrollStats);
router.get('/activator', dashboardController.getActivatorDashboard);

module.exports = router;

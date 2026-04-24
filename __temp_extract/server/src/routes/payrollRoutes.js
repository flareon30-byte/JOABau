const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Only Admins can see payroll
router.get('/summary', checkRole(['SUPER_ADMIN', 'ADMIN']), payrollController.getPayrollSummary);

// Technicians can see their own payroll
router.get('/my-summary', payrollController.getMyPayroll);

module.exports = router;

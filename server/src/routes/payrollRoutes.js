const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Only Admins can see payroll
router.get('/summary', checkRole(['SUPER_ADMIN', 'ADMIN']), payrollController.getPayrollSummary);
router.post('/archive', checkRole(['SUPER_ADMIN', 'ADMIN']), payrollController.archiveCurrentCycle);

// Technicians can see their own payroll
router.get('/my-summary', payrollController.getMyPayroll);
router.get('/history', payrollController.getArchiveHistory); // Can handle self or specific user via query

module.exports = router;

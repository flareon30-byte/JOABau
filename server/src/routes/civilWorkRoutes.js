const express = require('express');
const router = express.Router();
const civilWorkController = require('../controllers/civilWorkController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/map', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getMapData);
router.post('/location', verifyToken, checkRole(['CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.logLocation);
router.get('/assigned-pipes', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getAssignedPipes);
router.get('/addresses', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getAddressesSearch);
router.post('/daily-report', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.submitDailyReport);
router.get('/daily-reports', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getDailyReports);
router.post('/bulk-status', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.bulkUpdateCivilWorkStatus);
router.post('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.updateCivilWorkStatus);
router.put('/work-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.reviewWorkLog);
router.put('/duct-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.reviewDuctLog);

module.exports = router;

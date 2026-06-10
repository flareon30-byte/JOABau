const express = require('express');
const router = express.Router();
const civilWorkController = require('../controllers/civilWorkController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/map', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.getMapData);
router.post('/location', verifyToken, checkRole(['CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.logLocation);
router.get('/assigned-pipes', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getAssignedPipes);
router.get('/addresses', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.getAddressesSearch);
router.post('/daily-report', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.submitDailyReport);
router.get('/daily-reports', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.getDailyReports);
router.post('/bulk-status', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.bulkUpdateCivilWorkStatus);
router.post('/manual-duct', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.createManualDuctLog);
router.post('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER', 'SUBCONTRACTOR']), civilWorkController.updateCivilWorkStatus);
router.put('/work-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.reviewWorkLog);
router.put('/duct-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.reviewDuctLog);
router.put('/nvt-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.reviewNvtLog);

// Rejection and Resubmission routes
router.put('/work-log/:id/return', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.returnWorkLog);
router.put('/duct-log/:id/return', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.returnDuctLog);
router.put('/nvt-log/:id/return', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.returnNvtLog);
router.get('/returned', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'SUBCONTRACTOR', 'CIVIL_WORKER']), civilWorkController.getReturnedLogs);
router.put('/work-log/:id/resubmit', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'SUBCONTRACTOR', 'CIVIL_WORKER']), civilWorkController.resubmitWorkLog);
router.put('/duct-log/:id/resubmit', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'SUBCONTRACTOR', 'CIVIL_WORKER']), civilWorkController.resubmitDuctLog);
router.put('/nvt-log/:id/resubmit', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'SUBCONTRACTOR', 'CIVIL_WORKER']), civilWorkController.resubmitNvtLog);
router.put('/hp-log/:id/review', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'PROJECT_MANAGER', 'SITE_MANAGER']), civilWorkController.reviewHpLog);
router.put('/hp-log/:id/return', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.returnHpLog);
router.put('/hp-log/:id/resubmit', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'SUBCONTRACTOR', 'CIVIL_WORKER']), civilWorkController.resubmitHpLog);

router.delete('/duct-log/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), civilWorkController.deleteDuctLog);
router.put('/address/:id/gps', verifyToken, civilWorkController.updateAddressGps);

module.exports = router;

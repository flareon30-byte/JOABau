const express = require('express');
const router = express.Router();
const multer = require('multer');
const activationController = require('../controllers/activationController');
const exportController = require('../controllers/exportController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
    // ... (no change to storage) ...
});

const upload = multer({ storage: storage });

router.use(verifyToken);

router.get('/my-appointments', activationController.getMyAppointments);
router.get('/export-photos', checkRole(['ADMIN', 'SUPER_ADMIN', 'BACK_OFFICE']), exportController.exportActivationPhotos);
router.get('/billing/data', checkRole(['ADMIN', 'SUPER_ADMIN', 'BACK_OFFICE']), exportController.getBillingData);
router.get('/billing/export', checkRole(['ADMIN', 'SUPER_ADMIN', 'BACK_OFFICE']), exportController.exportBillingExcel);
router.get('/all', checkRole(['ADMIN', 'SUPER_ADMIN']), activationController.getAllActivations);
router.post('/generate-pdf', activationController.generatePdf);
router.post('/report/:addressId', upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'signedPdf', maxCount: 1 }
]), activationController.submitActivation);

module.exports = router;

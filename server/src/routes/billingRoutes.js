const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const exportController = require('../controllers/exportController'); // Re-use for GET/Export
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/seed-demo', async (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('node seed_demo.js', (err, stdout, stderr) => {
            res.json({ err: err ? err.message : null, stdout, stderr });
        });
    } catch(e) {
        res.json({ error: e.message });
    }
});

router.use(verifyToken);
const allowBilling = checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']);

router.get('/data', allowBilling, exportController.getBillingData);
router.get('/debug', exportController.debugBilling);
router.get('/export', allowBilling, exportController.exportBillingExcel);
router.get('/export-photos', allowBilling, exportController.exportActivationPhotos);

// DELETE Operations
router.delete('/soplado/:id', allowBilling, billingController.deleteSoplado);
router.delete('/fusion/:id', allowBilling, billingController.deleteFusion);
router.delete('/activation/:id', allowBilling, billingController.deleteActivation);
router.delete('/protocol/:id', allowBilling, billingController.deleteProtocol);
router.delete('/repair/:id', allowBilling, billingController.deleteRepair);
router.delete('/simpleInstallation/:id', allowBilling, billingController.deleteSimpleInstallation);

module.exports = router;

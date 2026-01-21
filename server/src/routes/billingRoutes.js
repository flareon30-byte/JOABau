const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const exportController = require('../controllers/exportController'); // Re-use for GET/Export
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Ensure only admins can access billing operations
const allowBilling = checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']);

// GET Data & Export (Moved from activationRoutes in theory, but I will duplicate/alias here for cleanliness)
// The user might still be calling /api/activation/billing/data, I should update frontend to use this new route eventually,
// but for now I'll just add the DELETE routes here and register this new file.
// Ideally, migrated entirely. I will expose them here too.
router.get('/data', allowBilling, exportController.getBillingData);
router.get('/export', allowBilling, exportController.exportBillingExcel);
router.get('/export-photos', allowBilling, exportController.exportActivationPhotos);

// DELETE Operations
router.delete('/soplado/:id', allowBilling, billingController.deleteSoplado);
router.delete('/fusion/:id', allowBilling, billingController.deleteFusion);
router.delete('/activation/:id', allowBilling, billingController.deleteActivation);
router.delete('/protocol/:id', allowBilling, billingController.deleteProtocol);

module.exports = router;

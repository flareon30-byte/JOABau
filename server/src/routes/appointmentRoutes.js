const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Only Back Office, Admin, Super Admin should access these
// But for simplicity in this MVP, we might allow authenticated users or restrict strictly.
// Let's restrict to relevant roles.
const allowedRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'];

const repairController = require('../controllers/repairController');

router.get('/pending', checkRole(allowedRoles), appointmentController.getPendingAppointments);
router.get('/scheduled', checkRole(allowedRoles), appointmentController.getScheduledAppointments);
router.get('/export', checkRole(allowedRoles), appointmentController.exportScheduledAppointments);
router.get('/export-all', checkRole(allowedRoles), appointmentController.exportAllByProject);
router.get('/escalated', checkRole(allowedRoles), appointmentController.getEscalatedAppointments);
router.get('/building', checkRole(allowedRoles), appointmentController.getBuildingClients);
router.post('/log-contact/:addressId', checkRole(allowedRoles), appointmentController.logContactAttempt);
router.post('/schedule/:addressId', checkRole(allowedRoles), appointmentController.scheduleAppointment);
router.post('/repair/:addressId', checkRole(allowedRoles), repairController.createRepairAppointment); // New Endpoint for Repairs

const operationalRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN', 'PROTOCOL_MANAGER', 'ACTIVATOR', 'BLOWER'];
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext)
    }
});
const upload = multer({ storage: storage });

router.put('/:id/status', checkRole(operationalRoles), appointmentController.updateStatus);
router.post('/request-appointment/:addressId', checkRole(operationalRoles), appointmentController.requestAppointment);
router.put('/protocol-status/:addressId', checkRole(['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN']), appointmentController.updateProtocolStatus);
router.post('/:id/recite', checkRole(operationalRoles), upload.array('photos', 5), appointmentController.reciteAppointment);
router.delete('/:id', checkRole(allowedRoles), appointmentController.deleteAppointment);
router.put('/address/:id/order-status', checkRole(allowedRoles), appointmentController.updateOrderStatus);
router.put('/address/:addressId/details', checkRole(allowedRoles), appointmentController.updateAddressDetails);
router.put('/comments/:commentId', checkRole(allowedRoles), upload.array('photos', 5), appointmentController.updateComment);

module.exports = router;

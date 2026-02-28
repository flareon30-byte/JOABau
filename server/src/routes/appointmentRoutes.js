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
router.get('/escalated', checkRole(allowedRoles), appointmentController.getEscalatedAppointments);
router.post('/log-contact/:addressId', checkRole(allowedRoles), appointmentController.logContactAttempt);
router.post('/schedule/:addressId', checkRole(allowedRoles), appointmentController.scheduleAppointment);
router.post('/repair/:addressId', checkRole(allowedRoles), repairController.createRepairAppointment); // New Endpoint for Repairs

const operationalRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN', 'PROTOCOL_MANAGER', 'ACTIVATOR', 'BLOWER'];
router.put('/:id/status', checkRole(operationalRoles), appointmentController.updateStatus);
router.put('/protocol-status/:addressId', checkRole(['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN']), appointmentController.updateProtocolStatus);
router.post('/:id/recite', checkRole(operationalRoles), appointmentController.reciteAppointment);
router.delete('/:id', checkRole(allowedRoles), appointmentController.deleteAppointment);
router.put('/address/:id/order-status', checkRole(allowedRoles), appointmentController.updateOrderStatus);

module.exports = router;

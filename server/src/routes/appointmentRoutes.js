const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Only Back Office, Admin, Super Admin should access these
// But for simplicity in this MVP, we might allow authenticated users or restrict strictly.
// Let's restrict to relevant roles.
const allowedRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'];

router.get('/pending', checkRole(allowedRoles), appointmentController.getPendingAppointments);
router.get('/scheduled', checkRole(allowedRoles), appointmentController.getScheduledAppointments);
router.post('/log-contact/:addressId', checkRole(allowedRoles), appointmentController.logContactAttempt);
router.post('/schedule/:addressId', checkRole(allowedRoles), appointmentController.scheduleAppointment);

const operationalRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN', 'PROTOCOL_MANAGER', 'ACTIVATOR', 'BLOWER'];
router.put('/:id/status', checkRole(operationalRoles), appointmentController.updateStatus);
router.post('/:id/recite', checkRole(operationalRoles), appointmentController.reciteAppointment);

module.exports = router;

const express = require('express');
const router = express.Router();
const vacationController = require('../controllers/vacationController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// User routes
router.post('/request', vacationController.requestVacation);
router.get('/my', vacationController.getMyVacations);

// Admin routes
router.get('/all', checkRole(['SUPER_ADMIN', 'ADMIN']), vacationController.getAllVacations);
router.get('/stats', checkRole(['SUPER_ADMIN', 'ADMIN']), vacationController.getUsersVacationStats);
router.put('/:id/status', checkRole(['SUPER_ADMIN', 'ADMIN']), vacationController.updateVacationStatus);

module.exports = router;

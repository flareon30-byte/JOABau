const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/debug', planningController.debugSub);

// Get executive dashboard data
router.get('/dashboard', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.getExecutiveDashboardData);

// Planned Works CRUD
router.get('/project/:projectId', verifyToken, planningController.getPlannedWorks);
router.post('/project/:projectId', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER']), planningController.createPlannedWork);
router.put('/:id', verifyToken, planningController.updatePlannedWork);
router.delete('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.deletePlannedWork);
router.get('/my-tasks', verifyToken, planningController.getMyPlannedWorks);

// Review Cycle Routes
router.post('/:id/submit', verifyToken, planningController.submitPlannedWork);
router.post('/:id/approve', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER']), planningController.approvePlannedWork);
router.post('/:id/reject', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER']), planningController.rejectPlannedWork);

module.exports = router;

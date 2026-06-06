const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Get executive dashboard data
router.get('/dashboard', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.getExecutiveDashboardData);

// Planned Works CRUD
router.get('/project/:projectId', verifyToken, planningController.getPlannedWorks);
router.post('/project/:projectId', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER']), planningController.createPlannedWork);
router.put('/:id', verifyToken, planningController.updatePlannedWork);
router.delete('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.deletePlannedWork);

module.exports = router;

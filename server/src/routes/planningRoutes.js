const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// Get executive dashboard data
router.get('/dashboard', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.getExecutiveDashboardData);

// Planned Works CRUD
router.get('/project/:projectId', authMiddleware, planningController.getPlannedWorks);
router.post('/project/:projectId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER']), planningController.createPlannedWork);
router.put('/:id', authMiddleware, planningController.updatePlannedWork);
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER']), planningController.deletePlannedWork);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const projectController = require('../controllers/projectController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.use(verifyToken);

// List projects (Now protected and role-filtered)
router.get('/', projectController.getAllProjects);

// Get map data for a specific project
router.get('/:id/map-data', projectController.getProjectMapData);

// Admin only actions
router.post('/', checkRole(['ADMIN', 'SUPER_ADMIN']), projectController.createProject);
router.post('/import', checkRole(['ADMIN', 'SUPER_ADMIN']), upload.single('file'), projectController.importProject);
router.put('/:id', checkRole(['ADMIN', 'SUPER_ADMIN']), projectController.updateProject);
router.delete('/:id', checkRole(['ADMIN', 'SUPER_ADMIN']), projectController.deleteProject);

module.exports = router;

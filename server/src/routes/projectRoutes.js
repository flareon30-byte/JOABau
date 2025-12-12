const express = require('express');
const router = express.Router();
const multer = require('multer');
const projectController = require('../controllers/projectController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.use(verifyToken);

// List projects (Available to all authenticated users? Or just admins? Let's say all for now so workers can select)
router.get('/', projectController.getAllProjects);

// Admin only actions
router.post('/', checkRole(['ADMIN', 'SUPER_ADMIN']), projectController.createProject);
router.post('/import', checkRole(['ADMIN', 'SUPER_ADMIN']), upload.single('file'), projectController.importProject);
router.delete('/:id', checkRole(['ADMIN', 'SUPER_ADMIN']), projectController.deleteProject);

module.exports = router;

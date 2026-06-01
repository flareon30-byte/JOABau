const express = require('express');
const router = express.Router();
const subcontractorController = require('../controllers/subcontractorController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), subcontractorController.getAllSubcontractors);
router.get('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), subcontractorController.getSubcontractorById);
router.post('/', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN']), subcontractorController.createSubcontractor);
router.put('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN']), subcontractorController.updateSubcontractor);
router.delete('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN']), subcontractorController.deleteSubcontractor);

module.exports = router;

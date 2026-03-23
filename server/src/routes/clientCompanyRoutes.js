const express = require('express');
const router = express.Router();
const clientCompanyController = require('../controllers/clientCompanyController');
const { requireRole } = require('../middleware/authMiddleware');

router.get('/', clientCompanyController.getAllClients);
router.post('/', requireRole(['SUPER_ADMIN']), clientCompanyController.createClient);
router.put('/:id', requireRole(['SUPER_ADMIN']), clientCompanyController.updateClient);
router.delete('/:id', requireRole(['SUPER_ADMIN']), clientCompanyController.deleteClient);

module.exports = router;

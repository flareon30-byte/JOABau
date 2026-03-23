const express = require('express');
const router = express.Router();
const clientCompanyController = require('../controllers/clientCompanyController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Get all clients - both admin and general users (for dropdowns) might need this
router.get('/', verifyToken, clientCompanyController.getAllClients);

// Only admins can create or update
router.post('/', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), clientCompanyController.createClient);
router.put('/:id', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), clientCompanyController.updateClient);

// Only super admin can delete
router.delete('/:id', verifyToken, checkRole(['SUPER_ADMIN']), clientCompanyController.deleteClient);

module.exports = router;

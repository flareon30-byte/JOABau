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

// Price items management
router.get('/:id/price-items', verifyToken, clientCompanyController.getClientPriceItems);
router.post('/:id/price-items', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), clientCompanyController.addPriceItem);
router.put('/:id/price-items/:itemId', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), clientCompanyController.updatePriceItem);
router.delete('/:id/price-items/:itemId', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), clientCompanyController.deletePriceItem);

module.exports = router;

const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/pending', verifyToken, invoiceController.getPendingWork);
router.post('/', verifyToken, invoiceController.createInvoice);
router.get('/', verifyToken, invoiceController.getInvoices);
router.patch('/:id/status', verifyToken, invoiceController.updateStatus);
router.delete('/:id', verifyToken, invoiceController.deleteInvoice);
router.post('/:id/regenerate', verifyToken, invoiceController.regeneratePdf);

module.exports = router;

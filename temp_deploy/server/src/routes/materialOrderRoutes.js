const express = require('express');
const router = express.Router();
const materialOrderController = require('../controllers/materialOrderController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.post('/', verifyToken, materialOrderController.createOrder);
router.get('/', verifyToken, materialOrderController.getOrders);
router.put('/:id/status', verifyToken, checkRole(['SUPER_ADMIN']), materialOrderController.updateOrderStatus);
router.delete('/:id', verifyToken, checkRole(['SUPER_ADMIN']), materialOrderController.deleteOrder);

module.exports = router;

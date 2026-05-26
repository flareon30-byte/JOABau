const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Protect all routes
router.use(verifyToken);

// Allow any logged-in user to change their active client
router.put('/active-client', userController.updateActiveClient);

// Allow any logged-in user to report their live GPS location
router.post('/live-location', userController.updateLiveLocation);

// Only Admin and Super Admin can manage users
router.use(checkRole(['ADMIN', 'SUPER_ADMIN']));

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;

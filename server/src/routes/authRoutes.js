const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
const authMiddleware = require('../middleware/authMiddleware');
router.post('/update-password', authMiddleware.verifyToken, authController.updatePassword);

module.exports = router;

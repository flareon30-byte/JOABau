const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/public', companyController.getPublicSettings); // Public branding for login page
router.get('/', verifyToken, companyController.getSettings);
router.post('/', verifyToken, companyController.updateSettings);

module.exports = router;

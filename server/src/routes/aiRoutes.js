const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/authMiddleware'); // assuming standard auth is used

router.post('/check-photo', verifyToken, aiController.checkPhotoQuality);

module.exports = router;

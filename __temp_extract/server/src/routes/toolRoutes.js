const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        // Normalize filename to prevent special char issues
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = file.originalname.split('.').pop() || 'jpg';
        cb(null, 'tool-' + uniqueSuffix + '.' + ext)
    }
});

const upload = multer({ storage: storage });

// Routes
router.get('/team/:teamId', verifyToken, toolController.getTeamTools);
router.post('/team/:teamId', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), upload.array('photos'), toolController.addTool);
router.put('/:id', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), toolController.updateTool);
router.delete('/:id', verifyToken, checkRole(['ADMIN', 'SUPER_ADMIN']), toolController.deleteTool);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const sopladoController = require('../controllers/sopladoController');
const { verifyToken } = require('../middleware/authMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1])
    }
});

const upload = multer({ storage: storage });

router.use(verifyToken);

// Get addresses for a project
router.get('/addresses/:projectId', sopladoController.getProjectAddresses);

// Submit report (photos are optional but supported)
router.post('/report/:addressId', upload.array('photos', 5), sopladoController.submitSopladoReport);

module.exports = router;

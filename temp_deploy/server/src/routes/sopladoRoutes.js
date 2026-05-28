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

const uploadMiddleware = (req, res, next) => {
    upload.any()(req, res, (err) => {
        if (err) {
            console.error(`[Multer Error on route ${req.method} ${req.url}]`, err);
            return res.status(400).json({
                message: `Error al subir imágenes: ${err.message}`,
                code: err.code
            });
        }
        next();
    });
};

router.use(verifyToken);

// Get addresses for a project
router.get('/addresses/:projectId', sopladoController.getProjectAddresses);

// Submit report (photos are optional but supported)
router.post('/report/:addressId', uploadMiddleware, sopladoController.submitSopladoReport);

// Quick Toggle Status
router.post('/toggle-status/:addressId', sopladoController.toggleSopladoStatus);

// Bulk Update
router.post('/bulk-update', sopladoController.bulkUpdateSopladoStatus);

// NVT Locations Management
router.get('/nvt-locations/:projectId', sopladoController.getNvtLocations);
router.post('/nvt-locations/:projectId', sopladoController.saveNvtLocation);

module.exports = router;

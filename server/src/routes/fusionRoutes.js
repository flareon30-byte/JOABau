const express = require('express');
const router = express.Router();
const multer = require('multer');
const fusionController = require('../controllers/fusionController');
const { verifyToken } = require('../middleware/authMiddleware');

// Configure multer for file uploads (reuse logic or import if shared, but duplicating for isolation is fine for now)
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

// Log Fusion Work
router.post('/log-work', uploadMiddleware, fusionController.logFusionWork);

// Get Fusion Works by Project (Optional filter ?nvt=...)
router.get('/works/:projectId', fusionController.getFusionWorks);

// Update Fusion Work
router.put('/work/:id', uploadMiddleware, fusionController.updateFusionWork);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext);
    }
});

const upload = multer({ storage: storage });

router.post('/', verifyToken, upload.array('photos', 20), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se han subido archivos' });
        }
        
        const urls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ urls });
    } catch (error) {
        console.error('Error in file upload:', error);
        res.status(500).json({ message: 'Error al subir archivos' });
    }
});

module.exports = router;

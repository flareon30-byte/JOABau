const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Only Back Office and Admins deal with issues creation usually
const allowedRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'];

const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext)
    }
});

const upload = multer({ storage: storage });

router.get('/search', checkRole(allowedRoles), issueController.searchAddressHistory);
router.post('/create', checkRole(allowedRoles), issueController.createManualIssue);
router.post('/create-existing', checkRole(allowedRoles), issueController.createFromExisting);

// Repair Routes
router.post('/repair/:addressId', upload.array('photos', 5), issueController.submitRepair);
router.get('/repairs', checkRole(['ADMIN', 'SUPER_ADMIN', 'BACK_OFFICE']), issueController.getRepairs);

module.exports = router;

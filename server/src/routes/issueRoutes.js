const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Only Back Office and Admins deal with issues creation usually
const allowedRoles = ['BACK_OFFICE', 'ADMIN', 'SUPER_ADMIN'];

router.get('/search', checkRole(allowedRoles), issueController.searchAddressHistory);
router.post('/create', checkRole(allowedRoles), issueController.createManualIssue);

module.exports = router;

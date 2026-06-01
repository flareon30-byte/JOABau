const express = require('express');
const router = express.Router();
const civilWorkController = require('../controllers/civilWorkController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.get('/map', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER']), civilWorkController.getMapData);
router.post('/location', verifyToken, checkRole(['CIVIL_WORKER']), civilWorkController.logLocation);
router.post('/:id', verifyToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'CIVIL_WORKER']), civilWorkController.updateCivilWorkStatus);

module.exports = router;

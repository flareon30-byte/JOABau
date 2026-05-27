const express = require('express');
const router = express.Router();
const accommodationController = require('../controllers/accommodationController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Protect all routes with auth token verify
router.use(verifyToken);

// Read routes: allowed for back office and admins
router.get('/', checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), accommodationController.getAllAccommodations);
router.get('/:id', checkRole(['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE']), accommodationController.getAccommodationById);

// Write routes: allowed only for admins
router.post('/', checkRole(['SUPER_ADMIN', 'ADMIN']), accommodationController.createAccommodation);
router.put('/:id', checkRole(['SUPER_ADMIN', 'ADMIN']), accommodationController.updateAccommodation);
router.delete('/:id', checkRole(['SUPER_ADMIN', 'ADMIN']), accommodationController.deleteAccommodation);

module.exports = router;

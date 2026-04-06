const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middleware/authMiddleware');

// Vehicle CRUD (Admin Only)
router.get('/', verifyToken, vehicleController.getAllVehicles);
router.post('/', verifyToken, vehicleController.createVehicle);
router.put('/:id', verifyToken, vehicleController.updateVehicle);
router.delete('/:id', verifyToken, vehicleController.deleteVehicle);
router.get('/:id/stats', verifyToken, vehicleController.getVehicleStats);

// Logs (For Techs)
router.post('/log', verifyToken, vehicleController.addVehicleLog);
router.delete('/log/:id', verifyToken, vehicleController.deleteVehicleLog);

module.exports = router;

const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const auth = require('../middleware/auth');

// Vehicle CRUD (Admin Only)
router.get('/', auth, vehicleController.getAllVehicles);
router.post('/', auth, vehicleController.createVehicle);
router.put('/:id', auth, vehicleController.updateVehicle);
router.delete('/:id', auth, vehicleController.deleteVehicle);
router.get('/:id/stats', auth, vehicleController.getVehicleStats);

// Logs (For Techs)
router.post('/log', auth, vehicleController.addVehicleLog);

module.exports = router;

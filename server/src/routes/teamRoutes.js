const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
// Allow Back Office to VIEW teams to assign appointments
router.get('/', teamController.getAllTeams);

// Only Admins can MANAGE teams
router.post('/', checkRole(['ADMIN', 'SUPER_ADMIN']), teamController.createTeam);
router.put('/:id', checkRole(['ADMIN', 'SUPER_ADMIN']), teamController.updateTeam);
router.delete('/:id', checkRole(['ADMIN', 'SUPER_ADMIN']), teamController.deleteTeam);

module.exports = router;

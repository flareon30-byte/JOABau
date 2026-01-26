const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(checkRole(['ADMIN', 'SUPER_ADMIN']));

router.get('/', teamController.getAllTeams);
router.post('/', teamController.createTeam);
router.put('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

module.exports = router;

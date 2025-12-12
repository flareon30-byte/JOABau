const prisma = require('../prisma');

exports.getAllTeams = async (req, res) => {
    try {
        const teams = await prisma.team.findMany({
            include: {
                members: {
                    select: { id: true, username: true, role: true }
                }
            }
        });
        res.json(teams);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching teams' });
    }
};

exports.createTeam = async (req, res) => {
    const { name, department, memberIds } = req.body;

    try {
        // Check if members are already in a team
        const membersWithTeam = await prisma.user.findMany({
            where: {
                id: { in: memberIds },
                teamId: { not: null }
            }
        });

        if (membersWithTeam.length > 0) {
            return res.status(400).json({
                message: `Users ${membersWithTeam.map(u => u.username).join(', ')} are already in a team`
            });
        }

        const team = await prisma.team.create({
            data: {
                name,
                department,
                members: {
                    connect: memberIds.map(id => ({ id }))
                }
            },
            include: {
                members: true
            }
        });

        res.status(201).json({ message: 'Team created', team });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating team' });
    }
};

exports.deleteTeam = async (req, res) => {
    const { id } = req.params;
    try {
        // First disconnect members
        await prisma.user.updateMany({
            where: { teamId: id },
            data: { teamId: null }
        });

        // Disconnect appointments
        await prisma.appointment.updateMany({
            where: { assignedTeamId: id },
            data: { assignedTeamId: null }
        });

        await prisma.team.delete({ where: { id } });
        res.json({ message: 'Team deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting team' });
    }
};

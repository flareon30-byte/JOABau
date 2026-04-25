const prisma = require('../prisma');

exports.getAllTeams = async (req, res) => {
    try {
        const isDemo = req.isDemo || false;
        const teams = await prisma.team.findMany({
            where: { isDemo },
            include: {
                members: {
                    select: { id: true, username: true, role: true }
                },
                activeClientCompany: true
            }
        });
        res.json(teams);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching teams' });
    }
};

exports.createTeam = async (req, res) => {
    const { name, department, memberIds, activeClientCompanyId } = req.body;

    try {
        // Enforce Demo Isolation: Cannot mix demo users with real users
        // Although the frontend will likely filter this, let's be safe later.
        // For now, let's just create the team with the correct flag.

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
                activeClientCompanyId: activeClientCompanyId || null,
                isDemo: req.isDemo || false,
                members: {
                    connect: memberIds.map(id => ({ id }))
                }
            },
            include: {
                members: true,
                activeClientCompany: true
            }
        });

        res.status(201).json({ message: 'Team created', team });
    } catch (error) {
        console.error('ERROR CREATING TEAM:', error);
        let message = 'Error al crear equipo';
        if (error.code === 'P2002') {
            const target = error.meta?.target ? `(Campo: ${error.meta.target})` : '';
            const fieldDescription = error.meta?.target?.includes('plate') ? 'el coche (matrícula)' : 'el nombre u otro dato único';
            message = `Dato duplicado ${target}: Ya existe un equipo con este dato. Revisa si lo creaste en modo Demo o con otro departamento.`;
        } else {
            message += ': ' + error.message;
        }
        res.status(500).json({ message });
    }
};

exports.updateTeam = async (req, res) => {
    const { id } = req.params;
    const { name, department, memberIds, activeClientCompanyId } = req.body;

    try {
        // Validation: Verify that new members are not in OTHER teams
        const busyMembers = await prisma.user.findMany({
            where: {
                id: { in: memberIds },
                AND: [
                    { teamId: { not: null } },
                    { teamId: { not: id } }
                ]
            }
        });

        if (busyMembers.length > 0) {
            return res.status(400).json({
                message: `Los usuarios ${busyMembers.map(u => u.username).join(', ')} ya están en otro equipo`
            });
        }

        // Update
        const team = await prisma.team.update({
            where: { id },
            data: {
                name,
                department,
                activeClientCompanyId: activeClientCompanyId || null,
                members: {
                    set: [], // Disconnect everyone
                    connect: memberIds.map(uid => ({ id: uid })) // Connect new list
                }
            },
            include: { members: true, activeClientCompany: true }
        });

        res.json({ message: 'Team updated', team });

    } catch (error) {
        console.error('ERROR UPDATING TEAM:', error);
        let message = 'Error al actualizar equipo';
        if (error.code === 'P2002') {
            message = `Dato duplicado: El ${error.meta?.target.includes('plate') ? 'vehículo' : 'nombre'} ya está en uso.`;
        } else {
            message += ': ' + error.message;
        }
        res.status(500).json({ message });
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

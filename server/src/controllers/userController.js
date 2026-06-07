const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

exports.getAllUsers = async (req, res) => {
    try {
        const isDemo = req.isDemo || false;
        const users = await prisma.user.findMany({
            where: { isDemo },
            select: {
                id: true,
                username: true,
                role: true,
                teamId: true,
                phone: true,
                vacationDaysTotal: true,
                activeClientCompanyId: true,
                vehicleId: true,
                subcontractorId: true,
                baseSalary: true,
                createdAt: true,
                projects: {
                    select: { id: true, name: true }
                }
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    const { username, password, role, teamId, phone, vacationDaysTotal, vehicleId, subcontractorId, projectIds } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role,
                permissions: req.body.permissions !== undefined ? req.body.permissions : [],
                teamId: teamId || null,
                phone: phone || null,
                vehicleId: vehicleId || null,
                subcontractorId: subcontractorId || null,
                baseSalary: (req.body.baseSalary !== undefined && req.body.baseSalary !== '') ? parseFloat(req.body.baseSalary) : 1500.0,
                vacationDaysTotal: (vacationDaysTotal !== undefined && vacationDaysTotal !== '') ? parseInt(vacationDaysTotal) : 30,
                isDemo: req.isDemo || false,
                projects: projectIds && Array.isArray(projectIds) ? {
                    connect: projectIds.map(id => ({ id }))
                } : undefined
            },
            include: { projects: true }
        });
        res.status(201).json({ message: 'User created', user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user', details: error.message });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, password, role, teamId, phone, vacationDaysTotal, vehicleId, subcontractorId, projectIds } = req.body;

    try {
        const data = {
            username,
            role,
            permissions: req.body.permissions !== undefined ? req.body.permissions : undefined,
            teamId: teamId || null,
            phone: phone || null,
            vehicleId: vehicleId || null,
            subcontractorId: subcontractorId || null,
            baseSalary: (req.body.baseSalary !== undefined && req.body.baseSalary !== '') ? parseFloat(req.body.baseSalary) : 1500.0,
            vacationDaysTotal: (vacationDaysTotal !== undefined && vacationDaysTotal !== '') ? parseInt(vacationDaysTotal) : 30
        };
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...data,
                projects: projectIds && Array.isArray(projectIds) ? {
                    set: projectIds.map(pid => ({ id: pid }))
                } : undefined
            },
            include: { projects: true }
        });
        res.json({ message: 'User updated', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user', details: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Error deleting user:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(500).json({ message: 'Error deleting user' });
    }
};

exports.updateActiveClient = async (req, res) => {
    try {
        const { activeClientCompanyId } = req.body;
        // The id comes from req.userId (the token)
        const userId = req.userId;

        const user = await prisma.user.update({
            where: { id: userId },
            data: { activeClientCompanyId: activeClientCompanyId || null },
            include: { activeClientCompany: true }
        });

        res.json({ message: 'Active client updated', activeClientCompanyId: user.activeClientCompanyId, activeClientCompany: user.activeClientCompany });
    } catch (error) {
        console.error('Error updating active client:', error);
        res.status(500).json({ message: 'Error updating active client' });
    }
};

exports.updateLiveLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Latitude and longitude are required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, teamId: true, username: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const liveLocations = require('../utils/liveLocations');
        if (user.teamId) {
            liveLocations.set(user.teamId, {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                username: user.username,
                updatedAt: new Date(),
                isTeam: true
            });
        } else {
            // Save under user.id if not in a team, so we can display them individually
            liveLocations.set(user.id, {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                username: user.username,
                updatedAt: new Date(),
                isTeam: false
            });
        }

        res.json({ message: 'Location updated successfully' });
    } catch (error) {
        console.error('Error updating live location:', error);
        res.status(500).json({ message: 'Error updating live location' });
    }
};

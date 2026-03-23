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
                createdAt: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    const { username, password, role, teamId, phone, vacationDaysTotal } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role,
                teamId: teamId || null,
                phone: phone || null,
                vacationDaysTotal: (vacationDaysTotal !== undefined && vacationDaysTotal !== '') ? parseInt(vacationDaysTotal) : 30,
                isDemo: req.isDemo || false
            }
        });
        res.status(201).json({ message: 'User created', user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user', details: error.message });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, password, role, teamId, phone, vacationDaysTotal } = req.body;

    try {
        const data = {
            username,
            role,
            teamId: teamId || null,
            phone: phone || null,
            vacationDaysTotal: (vacationDaysTotal !== undefined && vacationDaysTotal !== '') ? parseInt(vacationDaysTotal) : 30
        };
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data
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

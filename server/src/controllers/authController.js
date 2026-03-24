const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

exports.register = async (req, res) => {
    const { username, password, role, teamId } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: role || 'BLOWER', // Default role
                teamId
            }
        });

        res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ 
            where: { username },
            include: {
                activeClientCompany: true,
                team: {
                    include: {
                        activeClientCompany: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, role: user.role, isDemo: user.isDemo }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        // Hierarchy Logic:
        // 1. Admins/Backoffice: Manual override (activeClientCompany) > Team default
        // 2. Technicians: Team default > Manual override (rarely exists)
        let activeClientCompany;
        if (['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'].includes(user.role)) {
            activeClientCompany = user.activeClientCompany || (user.team ? user.team.activeClientCompany : null);
        } else {
            activeClientCompany = (user.team && user.team.activeClientCompany) 
                ? user.team.activeClientCompany 
                : (user.activeClientCompany || null);
        }
        
        const activeClientCompanyId = activeClientCompany ? activeClientCompany.id : null;

        res.json({ 
            message: 'Logged in successfully', 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role, 
                isDemo: user.isDemo,
                teamId: user.teamId,
                activeClientCompanyId,
                activeClientCompany
            } 
        });
    } catch (error) {
        console.error('Login Error Full Details:', error);
        res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
    }
};

exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId; // From authMiddleware

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Contraseña actual incorrecta' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Error al actualizar la contraseña' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: {
                activeClientCompany: true,
                team: {
                    include: {
                        activeClientCompany: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hierarchy Logic:
        // 1. Admins/Backoffice: Manual override (activeClientCompany) > Team default
        // 2. Technicians: Team default > Manual override (rarely exists)
        let activeClientCompany;
        if (['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'].includes(user.role)) {
            activeClientCompany = user.activeClientCompany || (user.team ? user.team.activeClientCompany : null);
        } else {
            activeClientCompany = (user.team && user.team.activeClientCompany) 
                ? user.team.activeClientCompany 
                : (user.activeClientCompany || null);
        }
        
        const activeClientCompanyId = activeClientCompany ? activeClientCompany.id : null;

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            isDemo: user.isDemo,
            teamId: user.teamId,
            activeClientCompanyId,
            activeClientCompany
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
};

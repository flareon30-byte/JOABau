const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

exports.verifyToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'No authenticated' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.isDemo = decoded.isDemo;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

exports.checkRole = (roles) => {
    return (req, res, next) => {
        console.log('Checking Role:', req.userRole, 'against', roles);
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

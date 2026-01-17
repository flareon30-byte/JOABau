const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const sopladoRoutes = require('./src/routes/sopladoRoutes');
const fusionRoutes = require('./src/routes/fusionRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const activationRoutes = require('./src/routes/activationRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// DEBUG LOGGER - Log every request
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/soplado', sopladoRoutes);
app.use('/api/fusion', fusionRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/activations', activationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/settings', require('./src/routes/settingsRoutes'));
app.use('/api/payroll', require('./src/routes/payrollRoutes'));
app.use('/api/billing', require('./src/routes/billingRoutes'));

app.get('/', (req, res) => {
    res.send('Fiber Optics App API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

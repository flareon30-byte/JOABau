const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const sopladoRoutes = require('./src/routes/sopladoRoutes');
const fusionRoutes = require('./src/routes/fusionRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const activationRoutes = require('./src/routes/activationRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const payrollRoutes = require('./src/routes/payrollRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const { initBackupJob } = require('./src/services/backupService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
app.use('/api/tools', require('./src/routes/toolRoutes'));
app.use('/api/issues', require('./src/routes/issueRoutes'));
app.use('/api/vacations', require('./src/routes/vacationRoutes'));
app.use('/api/material-orders', require('./src/routes/materialOrderRoutes'));
app.use('/api/clients', require('./src/routes/clientCompanyRoutes'));
app.use('/api/simple-installations', require('./src/routes/simpleInstallationRoutes'));

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Catch-all handler for any request that doesn't match an API route (SPA support)
// Note: Using (.*) because Express 5 (beta) uses a newer path-to-regexp that requires named parameters or explicit regex for wildcards
app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('API is running. Frontend build not found (run npm run build in client).');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initBackupJob(); // Start automated backups (Sundays 03:00)
});

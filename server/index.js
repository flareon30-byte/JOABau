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
const { initCleanupJob } = require('./src/services/cleanupService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
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
app.use('/api/settings', settingsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/billing', require('./src/routes/billingRoutes'));
app.use('/api/tools', require('./src/routes/toolRoutes'));
app.use('/api/issues', require('./src/routes/issueRoutes'));
app.use('/api/vacations', require('./src/routes/vacationRoutes'));
app.use('/api/material-orders', require('./src/routes/materialOrderRoutes'));
app.use('/api/clients', require('./src/routes/clientCompanyRoutes'));
app.use('/api/simple-installations', require('./src/routes/simpleInstallationRoutes'));
app.use('/api/vehicles', require('./src/routes/vehicleRoutes'));

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Catch-all handler for any request that doesn't match an API route (SPA support)
app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('API is running. Frontend build not found (run npm run build in client).');
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Auto-Sync Database Schema on Boot Disabled locally to avoid Locks
    /*
    const { exec } = require('child_process');
    console.log('[DB] Synchronizing schema...');
    exec('npx prisma db push --schema=prisma/schema.prisma --accept-data-loss', (error, stdout, stderr) => {
        if (error) {
            console.error(`[DB-ERROR] Schema sync failed: ${error.message}`);
            return;
        }
        console.log(`[DB] Schema synced successfully:\n${stdout}`);
    });
    */

    initBackupJob(); // Start automated backups (Sundays 03:00)
    initCleanupJob(); // Start automated cleanup (1st of each month 04:00)
});

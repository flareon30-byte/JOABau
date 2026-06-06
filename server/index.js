const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    console.log('[Init] Creating uploads directory...');
    fs.mkdirSync('uploads');
}

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const teamRoutes = require('./src/routes/teamRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const payrollRoutes = require('./src/routes/payrollRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const civilWorkRoutes = require('./src/routes/civilWorkRoutes');
const { initBackupJob } = require('./src/services/backupService');
const { initCleanupJob } = require('./src/services/cleanupService');
const { initAccommodationAlertJob } = require('./src/services/accommodationAlertService');

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
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/settings', settingsRoutes);
app.use('/api/accommodations', require('./src/routes/accommodationRoutes'));
app.use('/api/payroll', payrollRoutes);
app.use('/api/billing', require('./src/routes/billingRoutes'));
app.use('/api/tools', require('./src/routes/toolRoutes'));
app.use('/api/vacations', require('./src/routes/vacationRoutes'));
app.use('/api/material-orders', require('./src/routes/materialOrderRoutes'));
app.use('/api/clients', require('./src/routes/clientCompanyRoutes'));
app.use('/api/vehicles', require('./src/routes/vehicleRoutes'));
app.use('/api/dietas', require('./src/routes/dietaRoutes'));
app.use('/api/company', require('./src/routes/companyRoutes'));
app.use('/api/invoices', require('./src/routes/invoiceRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));
app.use('/api/subcontractors', require('./src/routes/subcontractorRoutes'));
app.use('/api/uploads', require('./src/routes/uploadRoutes'));
app.use('/api/civil-works', civilWorkRoutes);
app.use('/api/planning', require('./src/routes/planningRoutes'));


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
    
    initBackupJob(); // Start automated backups (Sundays 03:00)
    initCleanupJob(); // Start automated cleanup (1st of each month 04:00)
    initAccommodationAlertJob(); // Start monthly rental renewal alert (20th of each month 09:00)
});

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const backupDir = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const runBackup = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filePath = path.join(backupDir, filename);

    // Extract database connection details from DATABASE_URL
    // Expected format: postgresql://USER:PASSWORD@HOST:PORT/NAME
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('[BACKUP] DATABASE_URL not found');
        return;
    }

    console.log(`[BACKUP] Starting backup: ${filename}...`);

    // We use pg_dump. Since it's inside Docker, we can use the environment variables or the URL.
    // The pg_dump command needs the password, which can be provided via PGPASSWORD env var.
    const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlParts) {
        console.error('[BACKUP] Could not parse DATABASE_URL');
        return;
    }

    const [_, user, password, host, port, dbName] = urlParts;

    const command = `PGPASSWORD='${password}' pg_dump -h ${host} -p ${port} -U ${user} ${dbName} > ${filePath}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[BACKUP] Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`[BACKUP] Warning: ${stderr}`);
        }
        console.log(`[BACKUP] Backup completed successfully: ${filePath}`);

        // Optional: Clean up old backups (keep last 4 weeks)
        cleanOldBackups();
    });
};

const cleanOldBackups = () => {
    const files = fs.readdirSync(backupDir);
    const backups = files.filter(f => f.startsWith('backup-') && f.endsWith('.sql'));

    // Sort by name (which includes timestamp)
    backups.sort();

    // Keep only the last 5 backups
    if (backups.length > 5) {
        const toDelete = backups.slice(0, backups.length - 5);
        toDelete.forEach(file => {
            fs.unlinkSync(path.join(backupDir, file));
            console.log(`[BACKUP] Deleted old backup: ${file}`);
        });
    }
};

// Schedule: Every Sunday at 03:00 AM
const initBackupJob = () => {
    console.log('[BACKUP] Initializing weekly backup schedule (Sundays 03:00)...');
    cron.schedule('0 3 * * 0', () => {
        runBackup();
    });

    // Run an initial backup if the directory is empty
    const files = fs.readdirSync(backupDir);
    if (files.filter(f => f.endsWith('.sql')).length === 0) {
        console.log('[BACKUP] No backups found. Running initial backup...');
        runBackup();
    }
};

module.exports = { initBackupJob, runBackup };

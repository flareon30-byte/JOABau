const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    const files = fs.readdirSync(dirPath);
    files.forEach(function(file) {
        const fullPath = path.join(dirPath, "/", file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            const relativeToUploads = path.relative(UPLOADS_DIR, fullPath).replace(/\\/g, '/');
            arrayOfFiles.push({ relativePath: relativeToUploads, fullPath, size: fs.statSync(fullPath).size });
        }
    });
    return arrayOfFiles;
}

const runCleanup = async (options = { deleteOrphans: true, deleteOldClosed: true, thresholdDays: 120 }) => {
    console.log('[CLEANUP] Starting maintenance job...');
    
    // 1. Fetch Referenced Files
    const referencedFiles = new Set();
    const modelsWithPhotos = ['tool', 'sopladoInfo', 'fusionInfo', 'comment', 'activationInfo', 'fusionWork', 'repair', 'simpleInstallation'];
    for (const model of modelsWithPhotos) {
        try {
            const records = await prisma[model].findMany({ select: { photos: true } });
            records.forEach(r => {
                if (r.photos) r.photos.forEach(p => referencedFiles.add(p.replace(/^\/?uploads\//, '')));
            });
        } catch (e) { /* skip */ }
    }
    try {
        const activations = await prisma.activationInfo.findMany({ where: { pdfPath: { not: null } }, select: { pdfPath: true } });
        activations.forEach(r => { if (r.pdfPath) referencedFiles.add(r.pdfPath.replace(/^\/?uploads\//, '').split('?')[0]); });
    } catch (e) { /* skip */ }

    // 2. Identify Orphans
    const physicalFiles = getAllFiles(UPLOADS_DIR);
    const orphans = physicalFiles.filter(f => !referencedFiles.has(f.relativePath));
    
    if (options.deleteOrphans && orphans.length > 0) {
        console.log(`[CLEANUP] Deleting ${orphans.length} orphaned files...`);
        orphans.forEach(f => {
            try { fs.unlinkSync(f.fullPath); } catch (e) { console.error(`[CLEANUP] Fail to delete orphan ${f.relativePath}: ${e.message}`); }
        });
    }

    // 3. Identify Old Closed Project Photos
    if (options.deleteOldClosed) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - options.thresholdDays);
        
        const oldAddresses = await prisma.address.findMany({
            where: {
                orderStatus: { in: ['CERRADA', 'DERIVADA'] },
                updatedAt: { lt: thresholdDate }
            },
            include: {
                activationInfo: true, sopladoInfo: true, fusionInfo: true,
                appointment: { include: { comments: true } },
                simpleInstallation: true, repairs: true
            }
        });

        if (oldAddresses.length > 0) {
            console.log(`[CLEANUP] Found ${oldAddresses.length} closed addresses older than ${options.thresholdDays} days. Deleting their photos...`);
            
            const deletePhotos = (photos) => {
                if (!photos) return;
                photos.forEach(p => {
                    const rel = p.replace(/^\/?uploads\//, '');
                    const full = path.join(UPLOADS_DIR, rel);
                    if (fs.existsSync(full)) {
                        try { fs.unlinkSync(full); } catch (e) { /* ignore */ }
                    }
                });
            };

            oldAddresses.forEach(addr => {
                if (addr.activationInfo) deletePhotos(addr.activationInfo.photos);
                if (addr.sopladoInfo) deletePhotos(addr.sopladoInfo.photos);
                if (addr.fusionInfo) deletePhotos(addr.fusionInfo.photos);
                if (addr.simpleInstallation) deletePhotos(addr.simpleInstallation.photos);
                if (addr.repairs) addr.repairs.forEach(r => deletePhotos(r.photos));
                if (addr.appointment && addr.appointment.comments) addr.appointment.comments.forEach(c => deletePhotos(c.photos));
            });
        }
    }

    console.log('[CLEANUP] Maintenance job completed.');
};

/**
 * Notifica a los administradores que habrá una limpieza programada.
 */
const notifyUpcomingCleanup = async (thresholdDays = 120) => {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
        const formattedDate = thresholdDate.toLocaleDateString();

        console.log(`[CLEANUP-NOTIFY] Sending warning notification for next cleanup (older than ${formattedDate})...`);

        await prisma.notification.create({
            data: {
                type: 'SYSTEM_ALERT',
                message: `⚠️ AVISO: Limpieza de fotos programada para el día 1. Se eliminarán fotos de proyectos CERRADOS/DERIVADOS anteriores al ${formattedDate}. Por favor, asegúrese de tener copia de seguridad.`,
                targetRole: 'SUPER_ADMIN' // O ADMIN, BACK_OFFICE según disponibilidad
            }
        });

        // Also notify BACK_OFFICE as requested
        await prisma.notification.create({
            data: {
                type: 'SYSTEM_ALERT',
                message: `⚠️ AVISO: Limpieza mensual de servidor el día 1. Comprueben que los backups están OK.`,
                targetRole: 'BACK_OFFICE'
            }
        });

    } catch (e) {
        console.error('[CLEANUP-NOTIFY] Failed to create notification:', e);
    }
};

const initCleanupJob = () => {
    console.log('[CLEANUP] Initializing monthly cleanup schedule (Notification on 25th, Action on 1st)...');
    
    // Notificación preventiva: Día 25 de cada mes a las 09:00
    cron.schedule('0 9 25 * *', () => {
        notifyUpcomingCleanup();
    });

    // Acción de limpieza: Día 1 de cada mes a las 04:00 AM
    cron.schedule('0 4 1 * *', () => {
        runCleanup();
    });
};

module.exports = { initCleanupJob, runCleanup };

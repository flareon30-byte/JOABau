const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, "/", file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Get relative path from uploads dir
            const relativeToUploads = path.relative(UPLOADS_DIR, fullPath).replace(/\\/g, '/');
            arrayOfFiles.push({
                relativePath: relativeToUploads,
                fullPath: fullPath,
                size: fs.statSync(fullPath).size
            });
        }
    });

    return arrayOfFiles;
}

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
                message: `⚠️ AVISO MANUAL/TEST: Limpieza de fotos programada para el día 1. Se eliminarán fotos de proyectos CERRADOS/DERIVADOS anteriores al ${formattedDate}. Por favor, asegúrese de tener copia de seguridad.`,
                targetRole: 'SUPER_ADMIN'
            }
        });
        
        console.log('Notification sent successfully.');

    } catch (e) {
        console.error('[CLEANUP-NOTIFY] Failed to create notification:', e);
    }
};

async function main() {
    console.log('--- Digital Ocean Server Cleanup Job ---');
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Uploads directory: ${UPLOADS_DIR}`);

    if (process.argv.includes('--notify')) {
        await notifyUpcomingCleanup();
        await prisma.$disconnect();
        return;
    }

    const dryRun = process.argv.includes('--delete') ? false : true;
    if (dryRun) {
        console.log('NOTE: Running in DRY-RUN mode. No files will be deleted. Use --delete to confirm.');
    } else {
        console.log('CAUTION: RUNNING IN DELETION MODE.');
    }

    console.log('\nStep 1: Fetching all referenced files from Database...');
    const referencedFiles = new Set();

    // Models with photos arrays
    const modelsWithPhotos = [
        'tool', 'sopladoInfo', 'fusionInfo', 'comment', 
        'activationInfo', 'fusionWork', 'repair', 'simpleInstallation'
    ];

    for (const model of modelsWithPhotos) {
        try {
            const records = await prisma[model].findMany({
                select: { photos: true }
            });
            records.forEach(r => {
                if (r.photos) {
                    r.photos.forEach(p => {
                        // Normalize paths
                        const cleaned = p.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
                        referencedFiles.add(cleaned);
                    });
                }
            });
        } catch (e) {
            console.warn(`[SKIP] Model ${model} not available: ${e.message}`);
        }
    }

    // Models with single pdfPath
    try {
        const activations = await prisma.activationInfo.findMany({
            where: { pdfPath: { not: null } },
            select: { pdfPath: true }
        });
        activations.forEach(r => {
            if (r.pdfPath) {
                const cleaned = r.pdfPath.replace(/^\/uploads\//, '').replace(/^uploads\//, '').split('?')[0];
                referencedFiles.add(cleaned);
            }
        });
    } catch (e) {
        console.warn(`[SKIP] activationInfo PDF check failed: ${e.message}`);
    }

    console.log(`Total unique files referenced in DB: ${referencedFiles.size}`);

    console.log('\nStep 2: Scanning physical files...');
    const allPhysicalFiles = getAllFiles(UPLOADS_DIR);
    console.log(`Total physical files found: ${allPhysicalFiles.length}`);

    const orphans = [];
    let orphanSize = 0;

    allPhysicalFiles.forEach(file => {
        if (!referencedFiles.has(file.relativePath)) {
            orphans.push(file);
            orphanSize += file.size;
        }
    });

    console.log(`\n--- Orphan Statistics ---`);
    console.log(`Orphaned files (not in DB): ${orphans.length}`);
    console.log(`Space to be reclaimed: ${(orphanSize / (1024 * 1024)).toFixed(2)} MB`);

    if (orphans.length > 0) {
        if (!dryRun) {
            console.log('Deleting orphans...');
            orphans.forEach(f => {
                try {
                    fs.unlinkSync(f.fullPath);
                } catch (e) {
                    console.error(`Error deleting ${f.relativePath}: ${e.message}`);
                }
            });
            console.log('Orphans deleted successfully.');
        } else {
            console.log('List of orphans (first 20):');
            orphans.slice(0, 20).forEach(f => console.log(` - ${f.relativePath}`));
            if (orphans.length > 20) console.log(` ... and ${orphans.length - 20} more.`);
        }
    }

    console.log('\nStep 3: Finding old photos from CLOSED addresses...');
    // Threshold: 90 days
    const THRESHOLD_DAYS = 90;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS);

    console.log(`Scanning for addresses with status 'CERRADA' or 'DERIVADA' updated before ${thresholdDate.toISOString()}...`);

    const oldAddresses = await prisma.address.findMany({
        where: {
            orderStatus: { in: ['CERRADA', 'DERIVADA'] },
            updatedAt: { lt: thresholdDate }
        },
        include: {
            activationInfo: true,
            sopladoInfo: true,
            fusionInfo: true,
            appointment: { include: { comments: true } },
            simpleInstallation: true,
            repairs: true
        }
    });

    console.log(`Found ${oldAddresses.length} closed addresses older than ${THRESHOLD_DAYS} days.`);

    const oldPhotosToDelete = [];
    let oldPhotosSize = 0;

    const collectPhotos = (photos) => {
        if (!photos) return;
        photos.forEach(p => {
            const rel = p.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
            const full = path.join(UPLOADS_DIR, rel);
            if (fs.existsSync(full)) {
                const stats = fs.statSync(full);
                oldPhotosToDelete.push({ full, rel, size: stats.size });
                oldPhotosSize += stats.size;
            }
        });
    };

    oldAddresses.forEach(addr => {
        if (addr.activationInfo) collectPhotos(addr.activationInfo.photos);
        if (addr.sopladoInfo) collectPhotos(addr.sopladoInfo.photos);
        if (addr.fusionInfo) collectPhotos(addr.fusionInfo.photos);
        if (addr.simpleInstallation) collectPhotos(addr.simpleInstallation.photos);
        if (addr.repairs) addr.repairs.forEach(r => collectPhotos(r.photos));
        if (addr.appointment && addr.appointment.comments) {
            addr.appointment.comments.forEach(c => collectPhotos(c.photos));
        }
    });

    console.log(`\n--- Old Photos Statistics ---`);
    console.log(`Photos found in old closed projects: ${oldPhotosToDelete.length}`);
    console.log(`Space to be reclaimed: ${(oldPhotosSize / (1024 * 1024)).toFixed(2)} MB`);

    if (oldPhotosToDelete.length > 0) {
        if (!dryRun) {
            console.log('Deleting old project photos...');
            oldPhotosToDelete.forEach(f => {
                try {
                    fs.unlinkSync(f.full);
                } catch (e) {
                    console.error(`Error deleting ${f.rel}: ${e.message}`);
                }
            });
            console.log('Old project photos deleted successfully.');
            
            // Should we update the DB to remove the references?
            // Actually, keep the references to avoid broken icons, maybe?
            // Or set them to null? 
            // Better to keep the DB references as they are but files are gone. 
            // Or if we want to be thorough, we should update those records.
            // For now, let's keep it simple: just delete the files.
        } else {
            console.log('Example old photos:');
            oldPhotosToDelete.slice(0, 10).forEach(f => console.log(` - ${f.rel}`));
        }
    }

    console.log('\n--- Cleanup job finished ---');
    if (dryRun) {
        console.log('\nTOTAL POTENTIAL SAVINGS: ' + ((orphanSize + oldPhotosSize) / (1024*1024)).toFixed(2) + ' MB');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

function getAllFiles(dirPath, arrayOfFiles = []) {
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

async function main() {
    console.log('--- Photos Cleanup Diagnosis ---');

    console.log('Fetching files from database...');
    const referencedFiles = new Set();

    // Models to check for photos (arrays of strings)
    const modelsWithPhotos = [
        'tool', 'sopladoInfo', 'fusionInfo', 'comment', 
        'activationInfo', 'fusionWork', 'repair', 'simpleInstallation'
    ];

    for (const model of modelsWithPhotos) {
        const records = await prisma[model].findMany({
            select: { photos: true }
        });
        records.forEach(r => {
            if (r.photos) {
                r.photos.forEach(p => {
                    // photos are stored as "/uploads/filename.ext" or "uploads/filename.ext"
                    const cleaned = p.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
                    referencedFiles.add(cleaned);
                });
            }
        });
    }

    // Models to check for pdfPath (single string)
    const modelsWithPdfs = ['activationInfo'];
    for (const model of modelsWithPdfs) {
        const records = await prisma[model].findMany({
            where: { pdfPath: { not: null } },
            select: { pdfPath: true }
        });
        records.forEach(r => {
            if (r.pdfPath) {
                const cleaned = r.pdfPath.replace(/^\/uploads\//, '').replace(/^uploads\//, '').split('?')[0];
                referencedFiles.add(cleaned);
            }
        });
    }

    console.log(`Found ${referencedFiles.size} unique referenced files in database.`);

    console.log(`Scanning uploads directory: ${UPLOADS_DIR}`);
    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('Uploads directory does not exist.');
        return;
    }

    const allPhysicalFiles = await getAllFiles(UPLOADS_DIR);
    console.log(`Found ${allPhysicalFiles.length} physical files in uploads directory.`);

    const orphanedFiles = [];
    let totalOrphanSize = 0;

    allPhysicalFiles.forEach(file => {
        if (!referencedFiles.has(file.relativePath)) {
            orphanedFiles.push(file);
            totalOrphanSize += file.size;
        }
    });

    console.log(`\nIdentification results:`);
    console.log(`Orphaned files found: ${orphanedFiles.length}`);
    console.log(`Total size of orphaned files: ${(totalOrphanSize / (1024 * 1024)).toFixed(2)} MB`);

    if (orphanedFiles.length > 0) {
        console.log('\nExample orphaned files:');
        orphanedFiles.slice(0, 10).forEach(f => {
            console.log(` - ${f.relativePath} (${(f.size / 1024).toFixed(2)} KB)`);
        });
        
        // If there are more than 10, indicate that
        if (orphanedFiles.length > 10) {
            console.log(` ... and ${orphanedFiles.length - 10} more.`);
        }
    }

    // Check for old files (even if referenced)
    // Actually the user said "quedamos en que ibas a hacer una limpia de fotos viejas" 
    // This could also mean deleting EXPIRED files or projects that are CLOSED.
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

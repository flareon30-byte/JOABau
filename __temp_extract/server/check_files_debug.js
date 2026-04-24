const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- Checking PDF existence for last 10 activations ---');
    const acts = await prisma.activationInfo.findMany({
        take: 10,
        include: {
            address: {
                include: { project: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (acts.length === 0) {
        console.log('No activations found in database.');
        return;
    }

    for (const act of acts) {
        const dbPath = act.pdfPath;
        console.log(`\nAddress: ${act.address.street} ${act.address.number || ''}`);
        console.log(`DB Path: ${dbPath}`);
        
        if (!dbPath) {
            console.log('Status: Path is NULL');
            continue;
        }

        // Clean query string from path for existence check
        const cleanPath = dbPath.split('?')[0];
        
        // Resolve path relative to server root
        // In local dev, __dirname is server/
        // act.pdfPath is usually 'uploads/pdfs/...'
        const fullPath = path.join(__dirname, cleanPath);
        
        console.log(`Checking physical file at: ${fullPath}`);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            console.log(`Status: EXISTS | Size: ${stats.size} bytes`);
        } else {
            console.log('Status: MISSING on disk');
            
            // Try relative to current dir just in case
            const altPath = path.resolve(cleanPath);
            if (fs.existsSync(altPath)) {
                console.log(`Status: FOUND at alt path ${altPath}`);
            }
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

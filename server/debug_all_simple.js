const prisma = require('./src/prisma');

async function debug() {
    const simple = await prisma.simpleInstallation.findMany({
        include: { address: { include: { project: true } } }
    });
    
    console.log(`--- ALL SIMPLE INSTALLATIONS (${simple.length}) ---`);
    simple.slice(0, 10).forEach(a => {
        console.log(`ID: ${a.id} | Date: ${a.createdAt.toISOString()} | Project: ${a.address.project.name} | isDemo: ${a.address.project.isDemo}`);
    });
}

debug();

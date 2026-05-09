const prisma = require('./src/prisma');

async function debug() {
    const activations = await prisma.activationInfo.findMany({
        include: { address: { include: { project: true } } }
    });
    
    console.log('--- ALL ACTIVATIONS ---');
    activations.forEach(a => {
        console.log(`ID: ${a.id} | Date: ${a.createdAt.toISOString()} | Project: ${a.address.project.name} | isDemo: ${a.address.project.isDemo}`);
    });
}

debug();

const prisma = require('./src/prisma');

async function debug() {
    const projects = await prisma.project.findMany();
    for (const p of projects) {
        const counts = await prisma.activationInfo.count({
            where: { address: { projectId: p.id } }
        });
        console.log(`Project: ${p.name} | isDemo: ${p.isDemo} | Activations: ${counts}`);
    }
}

debug();

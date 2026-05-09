const prisma = require('./src/prisma');

async function debug() {
    const projects = await prisma.project.findMany();
    console.log('Projects:', projects.map(p => ({ name: p.name, isDemo: p.isDemo })));
}

debug();

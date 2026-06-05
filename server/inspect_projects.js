const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
    console.log('--- INSPECTING USERS ---');
    const users = await prisma.user.findMany({
        select: { id: true, username: true, role: true, isDemo: true }
    });
    console.log(users);

    console.log('--- INSPECTING PROJECTS ---');
    const projects = await prisma.project.findMany({
        include: {
            _count: { select: { addresses: true } }
        }
    });
    console.log(projects);

    console.log('--- INSPECTING ADDRESSES WITHOUT PROJECT ---');
    const orphanAddresses = await prisma.address.findMany({
        where: { projectId: null }
    });
    console.log(`Orphan addresses count: ${orphanAddresses.length}`);
}

inspect().finally(() => prisma.$disconnect());


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log('Starting cleanup of DEMO data...');

    try {
        // Delete Projects marked as isDemo=true (Cascades to addresses, etc.)
        const deletedProjects = await prisma.project.deleteMany({
            where: { isDemo: true }
        });
        console.log(`Deleted ${deletedProjects.count} demo projects.`);

        // Also delete Users marked as isDemo=true
        const deletedUsers = await prisma.user.deleteMany({
            where: { isDemo: true }
        });
        console.log(`Deleted ${deletedUsers.count} demo users.`);

        // Delete Teams marked as isDemo=true
        const deletedTeams = await prisma.team.deleteMany({
            where: { isDemo: true }
        });
        console.log(`Deleted ${deletedTeams.count} demo teams.`);

        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Error cleaning up:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();

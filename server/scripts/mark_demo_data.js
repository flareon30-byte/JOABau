
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Marking demo data...');
    try {
        // Mark known demo projects
        const res = await prisma.project.updateMany({
            where: {
                OR: [
                    { name: { contains: 'Fiber City', mode: 'insensitive' } },
                    { name: { contains: 'Demostración', mode: 'insensitive' } },
                    { name: { contains: 'Test', mode: 'insensitive' } }
                ]
            },
            data: { isDemo: true }
        });
        console.log(`Updated ${res.count} projects to isDemo=true.`);

        // Also ensure the demo user exists and isDemo
        const demoUser = await prisma.user.updateMany({
            where: { username: 'demo' },
            data: { isDemo: true }
        });
        console.log('Ensured demo user is marked as demo.');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

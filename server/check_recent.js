const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentActivations() {
    try {
        const activations = await prisma.activationInfo.findMany({
            take: 10,
            orderBy: { updatedAt: 'desc' },
            include: {
                address: true
            }
        });
        console.log(JSON.stringify(activations, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkRecentActivations();

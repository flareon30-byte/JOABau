const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function searchGK() {
    try {
        const gk = await prisma.simpleInstallation.findMany({
            where: {
                address: {
                    OR: [
                        { street: { contains: 'Abel', mode: 'insensitive' } },
                        { street: { contains: 'Thivant', mode: 'insensitive' } }
                    ]
                }
            },
            include: { address: true }
        });
        console.log('GK Results:', JSON.stringify(gk, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

searchGK();

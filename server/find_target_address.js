const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAddress() {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                OR: [
                    { street: { contains: 'Abel', mode: 'insensitive' } },
                    { street: { contains: 'Thivant', mode: 'insensitive' } }
                ]
            },
            include: {
                activationInfo: true,
                appointment: true
            }
        });
        console.log(JSON.stringify(addresses, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findAddress();

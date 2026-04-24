const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findByNumber() {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                number: '1'
            },
            take: 20
        });
        console.log(addresses.map(a => a.street));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findByNumber();

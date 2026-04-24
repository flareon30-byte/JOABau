const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCulpable() {
    try {
        const acts = await prisma.activationInfo.findMany({
            where: {
                taPrice: { gt: 0 }
            },
            include: {
                address: true
            }
        });
        console.log('Activations with TA charge:', JSON.stringify(acts.map(a => ({
            id: a.id,
            addressId: a.addressId,
            street: a.address.street,
            number: a.address.number,
            taPrice: a.taPrice,
            taCount: a.taCount,
            taInstalled: a.taInstalled
        })), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findCulpable();

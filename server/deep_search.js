const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findTheAddress() {
    try {
        console.log("Searching for 'Abel' or 'Thivant'...");
        const addresses = await prisma.address.findMany({
            where: {
                OR: [
                    { street: { contains: 'Abel', mode: 'insensitive' } },
                    { street: { contains: 'Thivant', mode: 'insensitive' } }
                ]
            },
            include: {
                activationInfo: true
            }
        });
        console.log('Results:', JSON.stringify(addresses, null, 2));
        
        if (addresses.length === 0) {
            console.log("No specific address found. Searching all recent activations...");
            const recent = await prisma.activationInfo.findMany({
                orderBy: { updatedAt: 'desc' },
                take: 10,
                include: { address: true }
            });
            console.log('Recent activations:', JSON.stringify(recent.map(r => ({
                id: r.id,
                street: r.address.street,
                number: r.address.number,
                taPrice: r.taPrice,
                taCount: r.taCount
            })), null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

findTheAddress();

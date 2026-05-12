const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const act = await prisma.activationInfo.findFirst({
        where: { createdAt: { gte: new Date('2026-05-01') } },
        orderBy: { updatedAt: 'desc' },
        include: { address: true }
    });
    console.log('Sample Activation:', JSON.stringify(act, null, 2));

    const prices = await prisma.clientPriceItem.findMany();
    console.log('Current Prices:', JSON.stringify(prices, null, 2));
}
debug();

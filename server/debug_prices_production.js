const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const act = await prisma.activationInfo.findFirst({
        where: { createdAt: { gte: new Date('2026-05-01') } },
        orderBy: { updatedAt: 'desc' },
        include: { address: true }
    });
    console.log('Sample Activation Details:');
    console.log('  ID:', act.id);
    console.log('  Type:', act.activationType);
    console.log('  Base Price:', act.basePrice);
    console.log('  TA Price:', act.taPrice);
    console.log('  SP Price:', act.spPrice);
    console.log('  MDU Price:', act.mduPrice);
    console.log('  Repair Price:', act.repairPrice);
    console.log('  Total Calculated Revenue:', act.basePrice + act.taPrice + act.spPrice + act.mduPrice + act.repairPrice);
    console.log('  TA Count:', act.taCount);

    const prices = await prisma.clientPriceItem.findMany({
        where: { clientCompanyId: act.address.project?.clientCompanyId || undefined }
    });
    console.log('Relevant Prices:', JSON.stringify(prices, null, 2));
}

debug();

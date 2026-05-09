const prisma = require('./src/prisma');

async function debug() {
    const total = await prisma.activationInfo.count();
    console.log(`Total activations in whole DB: ${total}`);
    
    const sample = await prisma.activationInfo.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
    });
    console.log('Last 10 creation dates:', sample.map(s => s.createdAt.toISOString()));
}

debug();

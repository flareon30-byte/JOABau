const prisma = require('./src/prisma');

async function debug() {
    console.log('--- DEBUG START ---');
    const user = await prisma.user.findFirst({
        where: { username: { contains: 'Alvaro', mode: 'insensitive' } }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log(`User found: ${user.username} (ID: ${user.id})`);

    const { getCycleDates } = require('./src/utils/financialUtils');
    const { start, end } = getCycleDates();

    console.log(`Cycle: ${start.toISOString()} to ${end.toISOString()}`);

    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: user.id }
        }
    });

    console.log(`Activations found for User ID ${user.id}: ${activations.length}`);

    const allActivationsInCycle = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end }
        }
    });

    console.log(`Total activations in cycle (any user): ${allActivationsInCycle.length}`);
    
    if (allActivationsInCycle.length > 0) {
        console.log('Sample activation performerIds:', allActivationsInCycle[0].performerIds);
        console.log('Sample activation type:', typeof allActivationsInCycle[0].performerIds[0]);
        console.log('User ID type:', typeof user.id);
    }

    console.log('--- DEBUG END ---');
}

debug();

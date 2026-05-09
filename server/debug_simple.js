const prisma = require('./src/prisma');

async function debug() {
    const { getCycleDates } = require('./src/utils/financialUtils');
    const { start, end } = getCycleDates();

    const simple = await prisma.simpleInstallation.count({
        where: {
            createdAt: { gte: start, lte: end }
        }
    });
    console.log(`SimpleInstallations in cycle: ${simple}`);
    
    if (simple > 0) {
        const sample = await prisma.simpleInstallation.findFirst({
             where: { createdAt: { gte: start, lte: end } }
        });
        console.log('Sample SimpleInstallation:', sample);
    }
}

debug();

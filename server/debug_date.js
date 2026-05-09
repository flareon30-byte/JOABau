const prisma = require('./src/prisma');

async function debug() {
    const act = await prisma.activationInfo.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log('Latest activation:', act);
}

debug();

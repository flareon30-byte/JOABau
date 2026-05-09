const prisma = require('./src/prisma');

async function debug() {
    const soplados = await prisma.sopladoInfo.count();
    console.log(`Total Soplados: ${soplados}`);
}

debug();

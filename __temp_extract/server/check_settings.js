const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
    const settings = await prisma.systemSettings.findFirst();
    console.log('System Settings:', JSON.stringify(settings, null, 2));
}

checkSettings()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

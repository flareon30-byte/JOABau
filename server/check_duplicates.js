const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMultipleSettings() {
    const count = await prisma.systemSettings.count();
    console.log('Total Settings Records:', count);

    const all = await prisma.systemSettings.findMany();
    all.forEach((s, i) => {
        console.log(`Setting ${i}: ID=${s.id}, Financials=${s.financials ? 'Present' : 'NULL'}`);
    });
}

checkMultipleSettings()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

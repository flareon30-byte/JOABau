const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking System Settings...');
    const settings = await prisma.systemSettings.findMany();
    console.log('Found', settings.length, 'settings records.');

    settings.forEach((s, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log('ID:', s.id);
        console.log('isDemo:', s.isDemo);
        console.log('Financials:', JSON.stringify(s.financials, null, 2));
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

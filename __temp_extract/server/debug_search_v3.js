const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    console.log('--- Test Search Broad ---');
    try {
        const count = await prisma.address.count();
        console.log(`Total addresses in DB: ${count}`);

        const results = await prisma.address.findMany({
            where: {
                street: { contains: 'Kittelbusch', mode: 'insensitive' }
            },
            take: 5
        });
        console.log(`Found ${results.length} containing "Kittelbusch".`);
        results.forEach(r => console.log(`- "${r.street}" "${r.number}" (ID: ${r.id})`));
    } catch (e) {
        console.error('An error occurred:', e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

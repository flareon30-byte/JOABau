const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking database state...');

        // 1. Check a known address
        const someAddress = await prisma.address.findFirst({
            where: {
                street: { contains: 'Ahorn', mode: 'insensitive' }
            },
            include: { sopladoInfo: true }
        });

        console.log('Sample Address:', JSON.stringify(someAddress, null, 2));

        // 2. Count "Soplado OK" addresses
        const okCount = await prisma.address.count({
            where: { sopladoStatus: 'OK' }
        });
        console.log(`Addresses with sopladoStatus 'OK': ${okCount}`);

        // 3. Count Pending Appointments that SHOULD match the controller query
        const pending = await prisma.address.count({
            where: {
                sopladoStatus: 'OK',
                OR: [
                    { appointment: { is: null } },
                    { appointment: { status: 'PENDIENTE' } }
                ]
            }
        });
        console.log(`Pending Appointments query count: ${pending}`);


    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

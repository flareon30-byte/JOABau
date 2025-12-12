const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const settings = await prisma.systemSettings.findFirst();
        console.log('Current settings:', settings);

        if (settings) {
            const updated = await prisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    bpPoints: 10.5,
                    sduPoints: 0.5
                }
            });
            console.log('Updated settings:', updated);
        } else {
            console.log('No settings found to update');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();

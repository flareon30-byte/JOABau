const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Seeding test address...');
        const addr = await prisma.address.create({
            data: {
                street: 'Am Kittelbusch',
                number: '24',
                city: 'Test City',
                orderStatus: 'geplant',
                project: {
                    create: {
                        name: 'Test Project',
                        isDemo: true
                    }
                },
                activationInfo: {
                    create: {
                        activationType: 'BP',
                        familiesCount: 1,
                        apPorts: 1,
                        hasMoreClients: false,
                        spInstalled: 0,
                        taInstalled: false,
                        points: 10,
                        photos: []
                    }
                },
                repairs: {
                    create: {
                        description: 'Test Repair via Seed',
                        technicianId: 'tech-1'
                    }
                }
            }
        });
        console.log('Created address:', addr.id);
    } catch (e) {
        console.error('Error seeding:', e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

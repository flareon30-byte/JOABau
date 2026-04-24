const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:12345@localhost:5432/fiber_optics_db?schema=public',
        },
    },
});

async function debugActivations() {
    try {
        console.log('--- DEBUGGING ACTIVATIONS ---');

        // 1. Fetch all ActivationInfo
        const activations = await prisma.activationInfo.findMany({
            include: {
                address: {
                    include: {
                        project: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        console.log(`Found ${activations.length} recent activations.`);

        activations.forEach(act => {
            console.log(`\nID: ${act.id}`);
            console.log(`Address: ${act.address.street} ${act.address.number}`);
            console.log(`Created At: ${act.createdAt}`);
            console.log(`Project: ${act.address.project.name} (ID: ${act.address.projectId})`);
            console.log(`Project Demo Status: ${act.address.project.isDemo}`);
            console.log(`Activation Type: ${act.activationType}`);
        });

        // 2. Simulate Controller Query (IsDemo = false)
        const isDemo = false;
        console.log('\n--- SIMULATING CONTROLLER QUERY (isDemo=false, No Filters) ---');
        const results = await prisma.activationInfo.findMany({
            where: {
                address: {
                    project: {
                        isDemo: isDemo,
                        ...(isDemo ? {} : { name: { not: { contains: 'Demo', mode: 'insensitive' } } })
                    }
                }
            },
            select: { id: true, address: { select: { street: true } } }
        });
        console.log(`Query matched ${results.length} activations.`);
        if (results.length === 0) {
            console.log("WARNING: Controller query returned 0 results! Check Project 'Demo' status.");
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugActivations();

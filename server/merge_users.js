const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://admin:securepassword@139.59.141.99:5434/fiberoptics?schema=public'
        }
    }
});

async function mergeUsers() {
    console.log('Starting user merge and cleanup...');

    // 1. Define pairs (Bad ID -> Good ID)
    const merges = [
        {
            bad: '7c63aba1-377d-4f16-9da9-20c66620bf9f', // "Alvaro"
            good: '3a6d11f6-2db2-4ed0-a56a-d94b9a604b63' // "Alvaro Alguacil"
        },
        {
            bad: '323c9f64-a0a3-4240-89c3-5103161c7c77', // "Alex Wildman" (Old)
            good: 'bb5b6bc6-b21b-40f6-b3b7-11e96af38be4' // "Alex Wildman" (Real)
        },
        {
            bad: '89b7f088-99af-4eb0-9758-a5fcab23d9fc', // "David"
            good: 'ac16c1a0-fcb3-495c-a4fe-b03906030479' // "David Espinosa"
        }
    ];

    for (const merge of merges) {
        console.log(`Merging ${merge.bad} into ${merge.good}...`);

        // Update performerIds in activations
        const acts = await prisma.activationInfo.findMany({
            where: { performerIds: { has: merge.bad } }
        });
        for (const act of acts) {
            const newPerformers = act.performerIds.map(id => id === merge.bad ? merge.good : id);
            await prisma.activationInfo.update({
                where: { id: act.id },
                data: { performerIds: newPerformers }
            });
        }
        console.log(`Updated ${acts.length} activations for this merge.`);

        // Update createdById if exists (check in different tables)
        await prisma.simpleInstallation.updateMany({
            where: { createdById: merge.bad },
            data: { createdById: merge.good }
        });

        // Finally, delete the bad user
        try {
            await prisma.user.delete({ where: { id: merge.bad } });
            console.log(`Deleted redundant user ${merge.bad}`);
        } catch (e) {
            console.warn(`Could not delete user ${merge.bad}: ${e.message}`);
        }
    }

    console.log('--- MERGE COMPLETED ---');
}

mergeUsers()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

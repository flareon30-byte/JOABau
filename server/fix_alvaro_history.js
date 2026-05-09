const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://admin:securepassword@139.59.141.99:5434/fiberoptics?schema=public'
        }
    }
});

async function fixAlvaroProduction() {
    const ALVARO_ID = '3a6d11f6-2db2-4ed0-a56a-d94b9a604b63';
    const DAVID_ID = 'ac16c1a0-fcb3-495c-a4fe-b03906030479';
    const ALEX_ID = 'bb5b6bc6-b21b-40f6-b3b7-11e96af38be4';
    const ERICK_ID = 'c8825302-fce5-41c2-9199-89ebede6c01b';

    const periods = [
        {
            start: new Date('2026-04-13T00:00:00Z'),
            end: new Date('2026-04-24T23:59:59Z'),
            members: [ERICK_ID, ALVARO_ID]
        },
        {
            start: new Date('2026-04-27T00:00:00Z'),
            end: new Date('2026-05-05T23:59:59Z'),
            members: [ALEX_ID, DAVID_ID, ALVARO_ID]
        },
        {
            start: new Date('2026-05-06T00:00:00Z'),
            end: new Date('2026-12-31T23:59:59Z'), 
            members: [DAVID_ID, ALVARO_ID]
        }
    ];

    console.log('Starting historical production fix for Alvaro...');

    for (const period of periods) {
        console.log(`Processing period: ${period.start.toISOString().split('T')[0]} to ${period.end.toISOString().split('T')[0]}`);
        
        // Find activations in this period
        const acts = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: period.start, lte: period.end }
            }
        });

        console.log(`Found ${acts.length} activations in this period.`);

        let updatedCount = 0;
        for (const act of acts) {
            // FORCE UPDATE to the correct members for this period
            await prisma.activationInfo.update({
                where: { id: act.id },
                data: {
                    performerIds: period.members
                }
            });
            updatedCount++;
        }
        console.log(`Updated ${updatedCount} activations.`);
    }

    console.log('--- FIX COMPLETED ---');
}

fixAlvaroProduction()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

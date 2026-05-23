const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSaturdays() {
    try {
        console.log('=== RETROACTIVE FIX FOR SATURDAY ACTIVATIONS ===');

        // 1. Fetch all activations where isSaturday is true
        const activations = await prisma.activationInfo.findMany({
            where: { isSaturday: true },
            include: { address: true }
        });

        console.log(`Found ${activations.length} activations flagged as isSaturday: true in the database.`);

        let correctedCount = 0;

        for (const act of activations) {
            const createdAtDate = new Date(act.createdAt);
            const dayOfWeek = createdAtDate.getDay(); // 0: Sunday, 6: Saturday

            if (dayOfWeek !== 6) {
                // This activation is flagged as isSaturday: true but its createdAt is NOT a Saturday!
                console.log(`[MISMATCH FOUND]`);
                console.log(`  ID: ${act.id}`);
                console.log(`  Address: ${act.address?.street} ${act.address?.number || ''}`);
                console.log(`  Date: ${createdAtDate.toISOString()} (Day of week: ${dayOfWeek} - Not a Saturday)`);
                console.log(`  Price: ${(act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0)}€`);
                
                // Update the record in the database
                await prisma.activationInfo.update({
                    where: { id: act.id },
                    data: { isSaturday: false }
                });
                
                console.log(`  -> STATUS: Fixed (isSaturday set to false)`);
                correctedCount++;
            } else {
                console.log(`[OK] ID: ${act.id} is on a Saturday (${createdAtDate.toISOString()})`);
            }
        }

        console.log('\n=== FIX SUMMARY ===');
        console.log(`Total records inspected: ${activations.length}`);
        console.log(`Total incorrect records fixed: ${correctedCount}`);

    } catch (e) {
        console.error('Error executing fix:', e);
    } finally {
        await prisma.$disconnect();
    }
}

fixSaturdays();

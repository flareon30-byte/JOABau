const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://admin:securepassword@139.59.141.99:5434/fiberoptics?schema=public'
        }
    }
});

async function restoreAttribution() {
    console.log('Starting global production attribution restoration...');

    // 1. Get all teams and their members for easy lookup
    const teams = await prisma.team.findMany({
        include: { members: true }
    });
    const teamMap = new Map(teams.map(t => [t.id, t.members.map(m => m.id)]));

    // 2. Fetch all activations from April 1st to now
    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: new Date('2026-04-01T00:00:00Z') }
        },
        include: {
            address: {
                include: {
                    appointment: true
                }
            }
        }
    });

    console.log(`Analyzing ${activations.length} activations...`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const act of activations) {
        const teamId = act.address?.appointment?.assignedTeamId;
        const members = teamId ? teamMap.get(teamId) : null;

        if (members && members.length > 0) {
            // Restore to the team members assigned to the appointment
            await prisma.activationInfo.update({
                where: { id: act.id },
                data: {
                    performerIds: members
                }
            });
            updatedCount++;
        } else {
            // If no team assigned, fallback to the creator as unique performer
            if (act.createdById) {
                await prisma.activationInfo.update({
                    where: { id: act.id },
                    data: {
                        performerIds: [act.createdById]
                    }
                });
                updatedCount++;
            } else {
                skippedCount++;
            }
        }
    }

    console.log(`--- RESTORATION COMPLETED ---`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (no info): ${skippedCount}`);
    process.exit(0);
}

restoreAttribution()
    .catch(e => { console.error(e); process.exit(1); });

const { PrismaClient } = require('@prisma/client');
const { calculateGroupFinancials, getWorkingDays } = require('./src/utils/financialUtils');
const { getGlobalSupportDeficit } = require('./src/services/financialService');
const { getCycleDates } = require('./src/controllers/payrollController');

const prisma = new PrismaClient();

async function debug() {
    const userId = '3a6d11f6-2db2-4ed0-a56a-d94b9a604b63'; // Alvaro CORRECT ID
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { team: { include: { members: true, activeClientCompany: true } }, activeClientCompany: true }
    });

    if (!user) {
        console.log('USER NOT FOUND with ID:', userId);
        process.exit(1);
    }

    const { start, end } = getCycleDates();
    console.log('--- DEBUG START ---');
    console.log('Cycle:', start.toISOString(), 'to', end.toISOString());

    // 1. Fetch activations
    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: userId }
        }
    });
    console.log('Activations found:', activations.length);

    // 2. Fetch Dietas
    const userDietasLogs = await prisma.dietaLog.findMany({
        where: {
            userId: userId,
            date: { gte: start, lte: end }
        }
    });
    let myDietasPayOnly = 0;
    userDietasLogs.forEach(d => {
        let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
        if (d.isSaturday) myDietasPayOnly += base;
        else myDietasPayOnly += (d.amount || 0);
    });
    console.log('Dietas cost:', myDietasPayOnly);

    // 3. Overhead
    const overhead = await getGlobalSupportDeficit(false, start, end);
    const teamMembersCount = user.team?.members?.length || 1;
    console.log('Global Overhead:', overhead);
    console.log('Team Members:', teamMembersCount);

    // 4. Working Days
    const wd = getWorkingDays(end.getFullYear(), end.getMonth());
    console.log('Working Days (May):', wd);

    // 5. Financial Config
    let fin = user.team?.activeClientCompany?.settings?.installers || {};
    
    // 6. CALCULATE
    const stats = calculateGroupFinancials(
        activations,
        fin,
        [user],
        overhead / teamMembersCount,
        wd,
        myDietasPayOnly,
        true,
        teamMembersCount,
        userId
    );

    console.log('--- RESULTS ---');
    console.log('BP Count:', stats.counts.bp);
    console.log('Revenue M-F:', stats.currentRevenueMf);
    console.log('Target Revenue:', stats.totalTargetRevenue);
    console.log('FINAL PERCENTAGE:', stats.progressPercent);
    console.log('--- DEBUG END ---');
    process.exit(0);
}

debug();

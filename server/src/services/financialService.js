const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

/**
 * Calculates the per-team share of the total company overhead (Structural Deficit).
 * Following the logic in Calculator/src/App.jsx
 */
exports.getGlobalSupportDeficit = async (isDemo = false) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date();

    const settings = await prisma.systemSettings.findFirst({
        where: { isDemo }
    });

    // 1. Fetch All Potential Support Users (Blowers, Back Office, Replanners)
    const supportUsers = await prisma.user.findMany({
        where: {
            isDemo,
            role: { in: ['BLOWER', 'BACK_OFFICE', 'REPLANNER'] }
        },
        include: { 
            activeClientCompany: true,
            team: { include: { members: true, activeClientCompany: true } }
        }
    });

    // 2. Fetch Production for Support Groups to see if they generate any revenue
    const soplados = await prisma.sopladoInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            address: { project: { isDemo } }
        }
    });

    const actsByTeam = {};
    soplados.forEach(s => {
        const tid = s.teamId;
        if (tid) {
            if (!actsByTeam[tid]) actsByTeam[tid] = [];
            actsByTeam[tid].push({
                isSaturday: s.isSaturday,
                activationType: 'BP',
                createdAt: s.createdAt,
                basePrice: 0
            });
        }
    });

    let totalSupportProfit = 0;
    const processedTeams = new Set();

    for (const u of supportUsers) {
        const groupKey = u.role === 'BLOWER' ? 'blowers' : (u.role === 'REPLANNER' ? 'replanners' : 'backOffice');
        
        let financialConfig = null;
        if (u.team?.activeClientCompany?.settings?.[groupKey]) {
            financialConfig = u.team.activeClientCompany.settings[groupKey];
        } else if (u.activeClientCompany?.settings?.[groupKey]) {
            financialConfig = u.activeClientCompany.settings[groupKey];
        } else if (settings?.financials?.[groupKey]) {
            financialConfig = settings.financials[groupKey];
        }

        if (u.role === 'BACK_OFFICE' || u.role === 'REPLANNER') {
            const salary = financialConfig?.salary || u.baseSalary || 1300;
            const appts = await prisma.appointment.count({
                where: { 
                    scheduledById: u.id, 
                    status: { in: ['CITADO', 'COMPLETADO'] }, 
                    updatedAt: { gte: start, lte: end } 
                }
            });
            const revPerUnit = u.role === 'BACK_OFFICE' ? (financialConfig?.pricePerAppointment || 15) : (financialConfig?.pricePerReplanteo || 15);
            const revenue = appts * revPerUnit;
            const insurance = financialConfig?.insurance || (salary * 0.215);
            const cost = salary + insurance + (financialConfig?.opCostPerPerson || 0);
            totalSupportProfit += (revenue - cost);
        } else if (u.teamId && !processedTeams.has(u.teamId)) {
            processedTeams.add(u.teamId);
            const teamActs = actsByTeam[u.teamId] || [];
            const teamMembers = u.team.members || [u];
            // Recursion is fine here since we pass 0 overhead
            const stats = calculateGroupFinancials(teamActs, financialConfig, teamMembers, 0);
            totalSupportProfit += stats.netResult;
        } else if (!u.teamId && u.role === 'BLOWER') {
            const salary = financialConfig?.salary || u.baseSalary || 1600;
            const insurance = financialConfig?.insurance || (salary * 0.215);
            totalSupportProfit -= (salary + insurance);
        }
    }

    // 3. Manager/Owner Costs (Matching App.jsx line 485)
    const OWNER_SALARY = 5000;
    const OWNER_SS = OWNER_SALARY * 0.215;
    const OWNER_TOTAL_COST = OWNER_SALARY + OWNER_SS;

    // 4. Count ALL Field Teams (Installers + Blowers)
    const installerTeamsCount = await prisma.team.count({
        where: { isDemo, members: { some: { role: 'ACTIVATOR' } } }
    });
    const blowerTeamsCount = await prisma.team.count({
        where: { isDemo, members: { some: { role: 'BLOWER' } } }
    });
    const totalFieldTeams = (installerTeamsCount || 0) + (blowerTeamsCount || 0);

    // 5. Total Deficit to cover
    const totalDeficit = Math.abs(Math.min(0, totalSupportProfit)) + OWNER_TOTAL_COST;

    // 6. Each team's mathematical share
    return totalFieldTeams > 0 ? (totalDeficit / totalFieldTeams) : 0;
};

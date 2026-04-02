const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

/**
 * Calculates the total deficit of support groups (Blowers, Back Office, etc.)
 * that needs to be covered by the core installer teams.
 */
exports.getGlobalSupportDeficit = async (isDemo = false) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date();

    const settings = await prisma.systemSettings.findFirst({
        where: { isDemo }
    });

    // 1. Fetch All Potential Support Users (Blowers & Back Office)
    const supportUsers = await prisma.user.findMany({
        where: {
            isDemo,
            role: { in: ['BLOWER', 'BACK_OFFICE'] }
        },
        include: { 
            activeClientCompany: true,
            team: { include: { members: true, activeClientCompany: true } }
        }
    });

    // 2. Fetch Production for Support Groups
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
        const groupKey = u.role === 'BLOWER' ? 'blowers' : 'backOffice';
        
        let financialConfig = null;
        if (u.team?.activeClientCompany?.settings?.[groupKey]) {
            financialConfig = u.team.activeClientCompany.settings[groupKey];
        } else if (u.activeClientCompany?.settings?.[groupKey]) {
            financialConfig = u.activeClientCompany.settings[groupKey];
        } else if (settings?.financials?.[groupKey]) {
            financialConfig = settings.financials[groupKey];
        }

        if (u.role === 'BACK_OFFICE') {
            const boSalary = financialConfig?.salary || u.baseSalary || 1500;
            const boAppts = await prisma.appointment.count({
                where: { 
                    scheduledById: u.id, 
                    status: { in: ['CITADO', 'COMPLETADO'] }, 
                    updatedAt: { gte: start, lte: end } 
                }
            });
            const boRev = boAppts * (financialConfig?.pricePerAppointment || 15);
            const insurance = financialConfig?.insurance || (boSalary * 0.215);
            const boCost = boSalary + insurance + (financialConfig?.opCostPerPerson || 0);
            totalSupportProfit += (boRev - boCost);
        } else if (u.teamId && !processedTeams.has(u.teamId)) {
            processedTeams.add(u.teamId);
            const teamActs = actsByTeam[u.teamId] || [];
            const teamMembers = u.team.members || [u];
            const stats = calculateGroupFinancials(teamActs, financialConfig, teamMembers, 0);
            totalSupportProfit += stats.netResult;
        } else if (!u.teamId && u.role === 'BLOWER') {
            const salary = financialConfig?.salary || u.baseSalary || 1500;
            const insurance = financialConfig?.insurance || (salary * 0.215);
            totalSupportProfit -= (salary + insurance);
        }
    }

    return totalSupportProfit < 0 ? Math.abs(totalSupportProfit) : 0;
};

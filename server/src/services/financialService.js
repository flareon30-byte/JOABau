const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

/**
 * Calculates the per-team share of the total company overhead (Structural Deficit).
 * Following the logic in Calculator/src/App.jsx
 */
exports.getGlobalSupportDeficit = async (isDemo = false, startDate = null, endDate = null) => {
    try {
        const now = new Date();
        const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDate || new Date();

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo }
        });

        // 1. Fetch All Potential Support Users (Strictly following DB Roles)
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

        let totalSupportProfit = 0;
        const processedTeams = new Set();

        // 2. Fetch Production for Support Groups (Blowing)
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
                const salary = financialConfig?.salary || u.baseSalary || 1300;
                const appts = await prisma.appointment.count({
                    where: { 
                        scheduledById: u.id, 
                        status: { in: ['CITADO', 'COMPLETADO'] }, 
                        updatedAt: { gte: start, lte: end } 
                    }
                });
                const revenue = appts * (financialConfig?.pricePerAppointment || 15);
                const insurance = financialConfig?.insurance || (salary * 0.215);
                const cost = salary + insurance + (financialConfig?.opCostPerPerson || 0);
                totalSupportProfit += (revenue - cost);
            } else if (u.teamId && !processedTeams.has(u.teamId)) {
                processedTeams.add(u.teamId);
                const teamActs = actsByTeam[u.teamId] || [];
                const teamMembers = u.team.members || [u];
                const stats = calculateGroupFinancials(teamActs, financialConfig || {}, teamMembers, 0);
                totalSupportProfit += stats.netResult;
            } else if (!u.teamId && u.role === 'BLOWER') {
                const salary = financialConfig?.salary || u.baseSalary || 1600;
                const insurance = financialConfig?.insurance || (salary * 0.215);
                totalSupportProfit -= (salary + insurance);
            }
        }

        // 3. Manager/Owner Costs (Calculator App.jsx)
        const OWNER_TOTAL_COST = 5000 + (5000 * 0.215);

        // 4. Count ALL Technicians in the field
        const totalTechnicians = await prisma.user.count({
            where: {
                isDemo,
                role: { in: ['ACTIVATOR', 'BLOWER'] }
            }
        });

        // 5. Calculate Result (Per Person)
        const totalDeficit = Math.abs(Math.min(0, totalSupportProfit)) + OWNER_TOTAL_COST;
        return totalTechnicians > 0 ? (totalDeficit / totalTechnicians) : 0;

    } catch (error) {
        console.error("Critical error calculating global deficit:", error);
        return 0; // Return zero overhead if calculation fails to keep app running
    }
};

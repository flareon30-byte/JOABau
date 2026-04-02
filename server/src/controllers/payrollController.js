const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

// Helper: Calculate working days for a given month/year (Default current)
// Simplified version of the calendar utils
const getWorkingDays = (year, month) => {
    // 0 = Jan, 11 = Dec
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    let count = 0;

    // Holidays NRW 2026 (simplified set for example)
    // In a real app, use a robust holiday library or DB table
    const holidays2026 = [
        '0-1', '2-29', '3-2', '4-1', '4-10', '4-21', '5-1', '5-11', '7-15', '9-3', '10-1', '11-25', '11-26'
        // Note: Month is 0-indexed in JS date, but let's use M-D strings
        // Adjust as needed for specific strictness. 
        // For now, let's use a standard approximation or the fixed value from the user's calculator if possible.
        // User calculator uses a util. Let's approximate to ~21 or calculate weekdays.
    ];

    // Simple Weekday Count
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
            count++;
        }
    }
    return count;
};

// (Redundant calculation logic moved to financialUtils.js)


exports.getMyPayroll = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { team: { include: { activeClientCompany: true } }, activeClientCompany: true }
        });

        if (!user || (!user.teamId && user.role !== 'SUPER_ADMIN' && user.role !== 'BACK_OFFICE')) {
            return res.status(400).json({ message: 'User not assigned to a team' });
        }

        const teamId = user.teamId;
        let team = null;

        if (teamId) {
            team = await prisma.team.findUnique({
                where: { id: teamId },
                include: { members: true }
            });
        }

        if (!team && user.role === 'SUPER_ADMIN') {
            team = { id: 'virtual', name: 'Modo Administrador', members: [user] };
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(); // Today

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // 1. Back Office Special Case (Individual view, no overhead calc needed for them usually)
        if (user.role === 'BACK_OFFICE') {
            let config = null;
            if (team?.activeClientCompany?.settings) {
                config = team.activeClientCompany.settings.backOffice;
            } else if (user.activeClientCompany?.settings) {
                config = user.activeClientCompany.settings.backOffice;
            } else {
                config = settings?.financials?.backOffice || {};
            }
            
            const apptCount = await prisma.appointment.count({
                where: {
                    scheduledById: user.id,
                    status: { in: ['CITADO', 'COMPLETADO'] },
                    updatedAt: { gte: start, lte: end }
                }
            });
            const revenue = apptCount * (config.pricePerAppointment || 15);
            return res.json({
                role: 'BACK_OFFICE',
                baseSalary: config.salary || user.baseSalary || 1500,
                metrics: { appointmentsDone: apptCount, targetDaily: 15, revenueGenerated: revenue },
                financials: { total: config.salary || 1500 }
            });
        }

        // 2. Installers/Blowers Logic
        const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
        
        let financialConfig = null;
        if (team?.activeClientCompany?.settings) {
            financialConfig = team.activeClientCompany.settings[groupKey];
        } else if (user.activeClientCompany?.settings) {
            financialConfig = user.activeClientCompany.settings[groupKey];
        }
        if (!financialConfig && settings?.financials) {
            financialConfig = settings.financials[groupKey];
        }

        let activations = [];
        if (teamId && teamId !== 'virtual') {
            if (groupKey === 'blowers') {
                const soplados = await prisma.sopladoInfo.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        teamId: teamId,
                        address: { project: { isDemo: req.isDemo || false } }
                    }
                });
                activations = soplados.map(s => ({
                    isSaturday: s.isSaturday,
                    activationType: 'BP',
                    createdAt: s.createdAt,
                    basePrice: 0
                }));
            } else {
                activations = await prisma.activationInfo.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        address: {
                            project: { isDemo: req.isDemo || false },
                            appointment: { assignedTeamId: teamId }
                        }
                    }
                });
            }
        }

        const teamMembers = team ? team.members : [user];

        // --- OVERHEAD CALCULATION (Global Deficit) ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await require('../services/financialService').getGlobalSupportDeficit(req.isDemo || false);
        }

        const stats = calculateGroupFinancials(activations, financialConfig, teamMembers, overheadToCover, getWorkingDays(now.getFullYear(), now.getMonth()));

        const memberCount = teamMembers.length || 1;
        const myBonus = stats.bonusPool / memberCount;
        const mySaturday = stats.saturdayPay / memberCount;
        const myTotal = (financialConfig?.salary || user.baseSalary) + myBonus + mySaturday;

        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

        // PRIVACY FILTER
        const filteredStats = { ...stats };
        if (!isAdmin) {
            delete filteredStats.totalRevenue;
            delete filteredStats.netResult;
            delete filteredStats.overheadApplied;
        }

        res.json({
            financials: financialConfig,
            stats: {
                ...filteredStats,
                activationsCount: activations.length,
                teamName: team?.name || 'Sin Equipo'
            },
            personal: {
                baseSalary: financialConfig?.salary || user.baseSalary || 0,
                myBonusShare: myBonus,
                mySaturdayPay: mySaturday,
                totalEstimated: myTotal
            }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate } = req.query; // Removed userId as it's for all
    try {
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (startDate && !startDate.includes('T')) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        if (endDate && !endDate.includes('T')) end.setHours(23, 59, 59, 999);

        const monthForDays = start.getMonth();
        const yearForDays = start.getFullYear();

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // Fetch Users & Activations
        const users = await prisma.user.findMany({
            where: { isDemo: req.isDemo || false },
            include: { team: { include: { members: true, activeClientCompany: true } }, activeClientCompany: true }
        });

        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: { project: { isDemo: req.isDemo || false } }
            },
            include: {
                address: { include: { appointment: { include: { assignedTeam: true } } } }
            }
        });

        const soplados = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: { project: { isDemo: req.isDemo || false } }
            }
        });

        // Map Activations to Team
        const teamActs = {};
        activations.forEach(act => {
            const tid = act.address?.appointment?.assignedTeamId;
            if (tid) {
                if (!teamActs[tid]) teamActs[tid] = [];
                teamActs[tid].push(act);
            }
        });
        soplados.forEach(s => {
            const tid = s.teamId;
            if (tid) {
                if (!teamActs[tid]) teamActs[tid] = [];
                teamActs[tid].push({
                    isSaturday: s.isSaturday,
                    activationType: 'BP',
                    createdAt: s.createdAt,
                    basePrice: 0
                });
            }
        });

        // We need to calculate Support Groups First to find Deficit (Overhead)
        // Group users by "Financial Type"
        const supportGroups = ['blowers', 'replanners', 'backoffice']; // Roles mapped to these keys
        let supportProfit = 0;

        // This is tricky because users are individual rows but calculation is by Team/Group.
        // We will calc per-user for the list, but for overhead we need conceptual "Groups".
        // Let's just calculate per-user/team stats normally and sum their NetResult.
        // If a team is "Blower", their profit adds to supportProfit.

        const processedUsers = users.map(user => {
            const team = user.team;
            const teamId = team?.id;

            // Determine Role/Group Key
            let groupKey = 'installers'; // Default
            if (user.role === 'BLOWER') groupKey = 'blowers';
            if (user.role === 'BACK_OFFICE') groupKey = 'backOffice';

            // Fetch Config (Per Client Priority)
            let financialConfig = null;
            if (team?.activeClientCompany?.settings) {
                financialConfig = team.activeClientCompany.settings[groupKey];
            } else if (user.activeClientCompany?.settings) {
                financialConfig = user.activeClientCompany.settings[groupKey];
            }
            if (!financialConfig && settings?.financials) {
                financialConfig = settings.financials[groupKey];
            }

            let stats = null;

            if (user.role === 'BACK_OFFICE') {
                // Simplified Back Office Calc
                const baseSalary = financialConfig?.salary || user.baseSalary || 1500;
                stats = { netResult: 0 - baseSalary }; // Cost center initially
            } else if (team) {
                const acts = teamActs[teamId] || [];
                // Calculate stats for the TEAM (shared)
                // We pass 0 overhead here initially, we might adjust later if we want perfect per-row deficit display
                stats = calculateGroupFinancials(acts, financialConfig, team.members, 0, getWorkingDays(yearForDays, monthForDays));
            } else {
                // Unassigned or Virtual
                const baseSalary = financialConfig?.salary || user.baseSalary || 1500;
                stats = { netResult: 0 - baseSalary };
            }

            return { user, stats, groupKey, financialConfig };
        });

        // Calc Deficit (Global)
        // Filter "Support" types to sum their Net Result. 
        // Note: This logic sums per USER if they are processed individually, 
        // but if they are in a TEAM, `stats` is calculated per TEAM effectively (repeated for members). 
        // We need to be careful not to double count team stats if iterating users.
        // Actually `processedUsers` maps 1:1 to users. 
        // `stats` for team members serves as their "share" view or identical team view.
        // For deficit calc, we should sum UNIQUE teams + independent users.

        const uniqueTeamsProcessed = new Set();
        let netOthers = 0;

        processedUsers.forEach(item => {
            if (item.groupKey !== 'installers') {
                if (item.user.teamId) {
                    if (!uniqueTeamsProcessed.has(item.user.teamId)) {
                        uniqueTeamsProcessed.add(item.user.teamId);
                        netOthers += (item.stats.netResult || 0);
                    }
                } else {
                    netOthers += (item.stats.netResult || 0);
                }
            }
        });

        // "If the total is negative, Installers need to cover that remaining hole."
        const totalDeficit = netOthers < 0 ? Math.abs(netOthers) : 0;

        const summary = processedUsers.map(({ user, stats, groupKey, financialConfig }) => {
            // Determine Base Salary
            // Priority: Config Salary -> User Base Salary -> Default 1500
            const configSalary = financialConfig ? parseFloat(financialConfig.salary) : null;
            const finalBaseSalary = (configSalary !== null && !isNaN(configSalary)) ? configSalary : (user.baseSalary || 1500);

            // Formating directly for frontend table
            const members = user.team?.members?.length || 1;

            // Per-person bonus share
            const shareBonus = (stats && stats.bonusPool) ? (stats.bonusPool / members) : 0;
            const shareSaturday = (stats && stats.saturdayPay) ? (stats.saturdayPay / members) : 0;

            const total = finalBaseSalary + shareBonus + shareSaturday;

            return {
                id: user.id,
                username: user.username,
                role: user.role,

                // Financials (Top Level for Table)
                baseSalary: finalBaseSalary,
                bonus: shareBonus,
                saturday: shareSaturday,
                total: total,

                // Production & Details
                production: {
                    ...stats,
                    type: groupKey,
                    teamName: user.team?.name || 'Sin Equipo',
                    appointmentsDone: stats?.appointmentsDone || 0
                }
            };
        });

        res.json({
            meta: { range: { start, end }, globalDeficit: totalDeficit },
            data: summary
        });

    } catch (error) {
        console.error('Error getting payroll summary:', error);
        res.status(500).json({ message: 'Error fetching payroll summary' });
    }
};

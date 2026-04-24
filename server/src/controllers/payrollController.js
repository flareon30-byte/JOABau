const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

// Helper: Calculate working days for a given month/year (Default current)
// Simplified version of the calendar utils
// Helper: Calculate working days for a given month/year
const getWorkingDays = (year, month) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    let count = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
};

// Helper: Accurate Cycle Calculation (21st to 20th)
exports.getCycleDates = (dateInput = new Date()) => {
    const date = new Date(dateInput);
    let start = new Date(date.getFullYear(), date.getMonth(), 21);
    let end = new Date(date.getFullYear(), date.getMonth() + 1, 20);

    // If we are on day 1-20, current cycle is (M-1).21 to M.20
    // If we are on day 21+, current cycle is M.21 to (M+1).20
    if (date.getDate() <= 20) {
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
    }
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
};

exports.getMyPayroll = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { team: { include: { activeClientCompany: true } }, activeClientCompany: true }
        });

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
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

        // --- NEW CYCLE LOGIC (21 TO 20) ---
        const { start, end } = getCycleDates();

        // 0. Fetch Dietas Logged for all team members (affects shared pool)
        const teamMemberIds = team ? team.members.map(m => m.id) : [userId];
        const allTeamDietas = await prisma.dietaLog.findMany({
            where: {
                userId: { in: teamMemberIds },
                date: { gte: start, lte: end }
            }
        });
        const teamDietasCost = allTeamDietas.reduce((acc, d) => acc + (d.amount || 0), 0);
        const myDietasPay = allTeamDietas.filter(d => d.userId === userId).reduce((acc, d) => acc + (d.amount || 0), 0);



        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // 1. Back Office Special Case
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
            const baseSalary = user.baseSalary || 1500;
            const revenue = apptCount * (config.pricePerAppointment || 15);
            return res.json({
                role: 'BACK_OFFICE',
                baseSalary: baseSalary,
                metrics: { appointmentsDone: apptCount, targetDaily: 15, revenueGenerated: revenue },
                financials: { total: baseSalary },
                cycle: { start, end }
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
        if (groupKey === 'blowers') {
            const soplados = await prisma.sopladoInfo.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    OR: [
                        { performerIds: { has: userId } },
                        { teamId: teamId || 'non-existent' }
                    ],
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
                    OR: [
                        { performerIds: { has: userId } },
                        {
                            address: {
                                project: { isDemo: req.isDemo || false },
                                appointment: { assignedTeamId: teamId || 'non-existent' }
                            }
                        }
                    ]
                }
            });
        }

        // 2b. Add SimpleInstallations (G&K)
        const simples = await prisma.simpleInstallation.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                createdById: userId
            },
            include: { items: { include: { priceItem: true } } }
        });
        simples.forEach(gk => {
            let instBonusTotal = 0;
            gk.items.forEach(item => { instBonusTotal += (item.bonusAtTime || 0) * (item.quantity || 1); });
            const bonusToCredit = gk.items.length > 0 ? instBonusTotal : (gk.priceCharged || 0);

            activations.push({
                isSaturday: gk.createdAt && new Date(gk.createdAt).getDay() === 6,
                activationType: 'GK',
                createdAt: gk.createdAt,
                basePrice: bonusToCredit,
                spPrice: 0, taPrice: 0, mduPrice: 0, repairPrice: 0
            });
        });

        const teamMembers = team ? team.members : [user];
        const now = new Date();

        // --- OVERHEAD CALCULATION ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await require('../services/financialService').getGlobalSupportDeficit(req.isDemo || false);
        }

        // --- DIETAS CALCULATION ---
        let myDietasPayOnly = 0;
        let mySaturdayExtraFromDietas = 0;
        const individualDietas = allTeamDietas.filter(d => d.userId === userId);
        individualDietas.forEach(d => {
            let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
            if (d.isSaturday) {
                let extra = d.amount - base;
                mySaturdayExtraFromDietas += extra;
                myDietasPayOnly += base;
            } else {
                myDietasPayOnly += d.amount;
            }
        });

        const stats = calculateGroupFinancials(
            activations, 
            financialConfig, 
            [user], 
            overheadToCover / (team?.members?.length || 1), 
            getWorkingDays(start.getFullYear(), start.getMonth()), 
            myDietasPayOnly, // Pasamos solo sus dietas como coste porque evaluamos individual
            true, // isIndividualMode
            team?.members?.length || 1, // userTeamSize para dividir el coche
            user.id // targetUserId
        );

        const memberCount = 1; // Ya no dividimos, porque stats ya es individual
        const myBonus = stats.bonusPool;

        const mySaturday = (stats.saturdayPay / memberCount) + mySaturdayExtraFromDietas;
        const myBaseSalary = user.baseSalary || 1500;
        const myTotal = myBaseSalary + myBonus + mySaturday + myDietasPayOnly;

        res.json({
            financials: financialConfig,
            stats: {
                ...stats,
                myTargetRevenue: stats.totalTargetRevenue,
                myCurrentRevenue: stats.currentRevenueMf,
                myProgressPercent: stats.progressPercent,
                activationsCount: activations.length,
                teamName: team?.name || 'Sin Equipo'
            },
            personal: {
                baseSalary: user.baseSalary || 1500,
                myBonusShare: myBonus,
                mySaturdayPay: mySaturday,
                myDietasPay: myDietasPayOnly,
                totalEstimated: myTotal
            },
            cycle: { start, end }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
};

// c:\Users\Yane Orden\Joa Technologien\server\src\controllers\payrollController.js

exports.archiveCurrentCycle = async (req, res) => {
    try {
        // When archiving, we usually want to archive the cycle that JUST ENDED (the 20th).
        // If today is 21st-31st, getCycleDates() would point to the NEW future cycle.
        // We subtract 2 days from "now" to make sure we are inside the period that ended on the 20th.
        const referenceDate = new Date();
        referenceDate.setDate(referenceDate.getDate() - 2); 
        
        const { start, end } = getCycleDates(referenceDate);
        const month = end.getMonth() + 1;
        const year = end.getFullYear();

        // 1. Fetch summary for the COMPLETED period
        const summaryResponse = await exports.getPayrollSummaryInternal(req, start, end);
        const data = summaryResponse.data;

        console.log(`[Archive] Guardando Foto Finish del ciclo ${month}/${year}...`);

        let count = 0;
        for (const item of data) {
            try {
                // Normalize dates to mid-day to avoid TZ jumps
                const safeStart = new Date(start);
                safeStart.setHours(12, 0, 0, 0);
                const safeEnd = new Date(end);
                safeEnd.setHours(12, 0, 0, 0);

                await prisma.payrollLog.upsert({
                    where: {
                        userId_month_year: { userId: item.id, month, year }
                    },
                    update: {
                        points: item.production?.unitsDone || 0,
                        pointEarnings: item.bonus || 0,
                        dietasCount: item.dietasCount || 0,
                        dietasAmount: item.dietaPay || 0,
                        saturdayPay: item.saturday || 0,
                        totalEuros: item.total || 0,
                        cycleStart: safeStart,
                        cycleEnd: safeEnd
                    },
                    create: {
                        userId: item.id,
                        month,
                        year,
                        points: item.production?.unitsDone || 0,
                        pointEarnings: item.bonus || 0,
                        dietasCount: item.dietasCount || 0,
                        dietasAmount: item.dietaPay || 0,
                        saturdayPay: item.saturday || 0,
                        totalEuros: item.total || 0,
                        cycleStart: safeStart,
                        cycleEnd: safeEnd
                    }
                });
                count++;
            } catch (e) {
                console.error(`[Archive Error] Error for user ${item.username}:`, e);
            }
        }

        res.json({ success: true, message: `Foto finish completada para ${count} trabajadores.` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error archiving cycle' });
    }
};

exports.getArchiveHistory = async (req, res) => {
    const { userId: filterUserId } = req.query; // Admin can filter by userId
    const userId = (req.role === 'SUPER_ADMIN' || req.role === 'ADMIN') && filterUserId ? filterUserId : req.userId;

    try {
        const logs = await prisma.payrollLog.findMany({
            where: { userId: userId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });
        res.json(logs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll history' });
    }
};

// Internal Helper for Summary (Unified logic for Export, View and Archive)
exports.getPayrollSummaryInternal = async (req, start, end, userIdFilter = 'all') => {
    const settings = await prisma.systemSettings.findFirst({
        where: { isDemo: req.isDemo || false }
    });

    const monthForDays = start.getMonth();
    const yearForDays = start.getFullYear();

    // 1. Fetch Users (With Filter)
    const userConditions = { isDemo: req.isDemo || false };
    if (userIdFilter && userIdFilter !== 'all') {
        userConditions.id = userIdFilter;
    }

    const users = await prisma.user.findMany({
        where: userConditions,
        include: { 
            team: { include: { members: true, activeClientCompany: true } }, 
            activeClientCompany: true,
            dietaLogs: {
                where: { date: { gte: start, lte: end } }
            },
            scheduledAppointments: {
                where: { 
                    status: { in: ['CITADO', 'COMPLETADO'] },
                    updatedAt: { gte: start, lte: end }
                }
            }
        }
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

    // Mapping maps teams AND individual users to their work
    const workMapping = {}; // By userId or teamId
    const addToMap = (id, work) => {
        if (!workMapping[id]) workMapping[id] = [];
        workMapping[id].push(work);
    };

    activations.forEach(act => {
        const tid = act.address?.appointment?.assignedTeamId;
        if (tid) addToMap(tid, act);
        
        // Also map to individual performers (this covers deleted teams)
        if (act.performerIds && act.performerIds.length > 0) {
            act.performerIds.forEach(uid => addToMap(uid, act));
        }
    });

    soplados.forEach(s => {
        const tid = s.teamId;
        if (tid) addToMap(tid, {
            isSaturday: s.isSaturday,
            activationType: 'BP',
            createdAt: s.createdAt,
            basePrice: 0
        });

        if (s.performerIds && s.performerIds.length > 0) {
            s.performerIds.forEach(uid => addToMap(uid, {
                isSaturday: s.isSaturday,
                activationType: 'BP',
                createdAt: s.createdAt,
                basePrice: 0
            }));
        }
    });

    const processedUsers = users.map(user => {
        const team = user.team;
        const teamId = team?.id;
        let groupKey = user.role === 'BLOWER' ? 'blowers' : (user.role === 'BACK_OFFICE' ? 'backOffice' : 'installers');

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
            const baseSalary = financialConfig?.salary || user.baseSalary || 1500;
            const apptCount = user.scheduledAppointments ? user.scheduledAppointments.length : 0; // Simplified
            stats = { 
                netResult: 0 - baseSalary, 
                appointmentsDone: apptCount,
                totalRevenue: apptCount * (financialConfig?.pricePerAppointment || 15)
            };
        } else {
            // Priority: work explicitly assigned to user, fallback to team work
            const myActs = workMapping[user.id] || [];
            const teamActs = teamId ? (workMapping[teamId] || []) : [];
            
            // Deduplicate (in case it's in both)
            const allMyWork = [...new Map([...teamActs, ...myActs].map(item => [item.id || item.createdAt, item])).values()];
            
            let userDietas = 0;
            user.dietaLogs?.forEach(d => {
                userDietas += d.amount;
            });

            stats = calculateGroupFinancials(
                allMyWork, 
                financialConfig, 
                [user], 
                0, 
                getWorkingDays(yearForDays, monthForDays), 
                userDietas,
                true,
                team?.members?.length || 1,
                user.id
            );
        }

        return { user, stats, groupKey, financialConfig };
    });

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

    const totalDeficit = netOthers < 0 ? Math.abs(netOthers) : 0;

    const data = processedUsers.map(({ user, stats, groupKey, financialConfig }) => {
        const finalBaseSalary = user.baseSalary || 1500;
        const members = user.team?.members?.length || 1;
        const shareBonus = (stats && stats.bonusPool) ? stats.bonusPool : 0; // El bonus ya está calculado de forma individual
        
        let splitDietaPay = 0;
        let splitSaturdayExtra = 0;
        user.dietaLogs?.forEach(d => {
            let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
            if (d.isSaturday) {
                // DietaLog saved the Extra in the total amount. Extract it out.
                let extra = d.amount - base;
                splitSaturdayExtra += extra;
                splitDietaPay += base;
            } else {
                splitDietaPay += d.amount;
            }
        });

        // Add any activation-based saturday pay to the separated dieta extra
        const shareSaturday = ((stats && stats.saturdayPay) ? (stats.saturdayPay / members) : 0) + splitSaturdayExtra;
        const dietaPay = splitDietaPay;
        const dietasCount = user.dietaLogs?.length || 0;
        const total = finalBaseSalary + shareBonus + shareSaturday + dietaPay;

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            baseSalary: finalBaseSalary,
            bonus: shareBonus,
            saturday: shareSaturday,
            dietaPay: dietaPay,
            dietasCount: dietasCount,
            total: total,
            production: { ...stats, type: groupKey, teamName: user.team?.name || 'Sin Equipo' }
        };
    });

    return { data, meta: { range: { start, end }, globalDeficit: totalDeficit } };
};

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    try {
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            const cycle = getCycleDates();
            start = cycle.start;
            end = cycle.end;
        }

        const result = await exports.getPayrollSummaryInternal(req, start, end, userId);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll summary' });
    }
};

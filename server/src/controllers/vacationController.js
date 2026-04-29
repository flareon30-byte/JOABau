const prisma = require('../prisma');
const { sendPushToRole, sendPushToUser } = require('../utils/notificationUtils');

// Helper for Easter Calculation (Meeus/Jones/Butcher algorithm)
// ... (rest of helpers)

// Helper for Easter Calculation (Meeus/Jones/Butcher algorithm)
const getEaster = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

// Returns an array of YYYY-MM-DD strings for German national holidays + NRW Specifics
const getGermanHolidays = (year) => {
    const holidays = [
        `${year}-01-01`, // Neujahr
        `${year}-05-01`, // Tag der Arbeit
        `${year}-10-03`, // Tag der Deutschen Einheit
        `${year}-11-01`, // Allerheiligen (NRW Specific)
        `${year}-12-25`, // 1. Weihnachtstag
        `${year}-12-26`, // 2. Weihnachtstag
    ];

    const easter = getEaster(year);
    const offsets = [
        -2, // Karfreitag
        1,  // Ostermontag
        39, // Christi Himmelfahrt
        50, // Pfingstmontag
        60  // Fronleichnam (NRW Specific)
    ];

    offsets.forEach(offset => {
        const d = new Date(easter);
        d.setDate(easter.getDate() + offset);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        holidays.push(`${y}-${m}-${day}`);
    });

    return holidays;
};

// Improved helper to calculate working days (excludes Weekends and German Holidays)
const calculateBusinessDays = (startDate, endDate) => {
    let count = 0;
    const curDate = new Date(startDate);
    const end = new Date(endDate);
    
    // Cache holidays for years involved in range
    const holidayCache = {};
    
    while (curDate <= end) {
        const year = curDate.getFullYear();
        if (!holidayCache[year]) holidayCache[year] = getGermanHolidays(year);

        const dayOfWeek = curDate.getDay();
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const day = String(curDate.getDate()).padStart(2, '0');
        const dateString = `${y}-${m}-${day}`;
        
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isHoliday = holidayCache[year].includes(dateString);

        if (!isWeekend && !isHoliday) {
            count++;
        }
        
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

// Create a vacation request
exports.requestVacation = async (req, res) => {
    const { startDate, endDate, type, reason } = req.body;
    const userId = req.userId;

    try {
        const request = await prisma.vacationRequest.create({
            data: {
                userId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                type: type || 'VACATION',
                reason,
                status: 'PENDING'
            },
            include: { user: true }
        });

        // Notify Super Admin
        await prisma.notification.create({
            data: {
                type: 'VACATION_REQUEST',
                message: `Nueva solicitud de vacaciones de ${request.user.username} (${startDate} a ${endDate})`,
                targetRole: 'SUPER_ADMIN',
                createdById: userId
            }
        });

        // Notify Back Office too
        await prisma.notification.create({
            data: {
                type: 'VACATION_REQUEST',
                message: `Nueva solicitud de vacaciones de ${request.user.username} (${startDate} a ${endDate})`,
                targetRole: 'BACK_OFFICE',
                createdById: userId
            }
        });

        // 🟢 SEND PUSH NOTIFICATIONS
        const pushPayload = {
            title: '🏖️ Solicitud de Vacaciones',
            body: `${request.user.username} ha solicitado vacaciones del ${startDate} al ${endDate}.`,
            data: { url: '/dashboard/vacations-admin' }
        };

        sendPushToRole('SUPER_ADMIN', pushPayload).catch(e => console.error("Push error SA:", e.message));
        sendPushToRole('BACK_OFFICE', pushPayload).catch(e => console.error("Push error BO:", e.message));

        res.status(201).json(request);
    } catch (error) {
        console.error('Error requesting vacation:', error);
        res.status(500).json({ message: 'Error solicitando vacaciones' });
    }
};

// Get my vacation requests
exports.getMyVacations = async (req, res) => {
    const userId = req.userId;

    try {
        const requests = await prisma.vacationRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { vacationDaysTotal: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const totalDays = user.vacationDaysTotal ?? 30;

        // Calculate days used
        const approvedRequests = requests.filter(r => r.status === 'APPROVED');
        let daysUsed = 0;
        approvedRequests.forEach(r => {
            daysUsed += calculateBusinessDays(r.startDate, r.endDate);
        });

        res.json({
            requests,
            stats: {
                total: totalDays,
                used: daysUsed,
                remaining: totalDays - daysUsed
            }
        });
    } catch (error) {
        console.error('Error fetching my vacations:', error);
        res.status(500).json({ message: 'Error al obtener vacaciones', details: error.message });
    }
};

// Get all vacation requests (Admin)
exports.getAllVacations = async (req, res) => {
    try {
        const requests = await prisma.vacationRequest.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching all vacations:', error);
        res.status(500).json({ message: 'Error al obtener todas las vacaciones' });
    }
};

// Get all users' vacation statistics (Admin)
exports.getUsersVacationStats = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                vacationDaysTotal: true,
                vacationRequests: {
                    where: { status: 'APPROVED' },
                    select: { startDate: true, endDate: true }
                }
            }
        });

        const stats = users.map(user => {
            const total = user.vacationDaysTotal || 30;
            let used = 0;
            user.vacationRequests.forEach(req => {
                used += calculateBusinessDays(req.startDate, req.endDate);
            });

            return {
                id: user.id,
                username: user.username,
                total,
                used,
                remaining: total - used
            };
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching user vacation stats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de vacaciones' });
    }
};

// Update vacation status (Admin)
exports.updateVacationStatus = async (req, res) => {
    const { id } = req.params;
    const { status, managerComment } = req.body;

    try {
        const request = await prisma.vacationRequest.update({
            where: { id },
            data: { status, managerComment },
            include: { user: true }
        });

        // Notify User
        const updateMsg = `Tu solicitud de vacaciones ha sido ${status === 'APPROVED' ? 'APROBADA' : 'DENEGADA'}.`;
        await prisma.notification.create({
            data: {
                type: 'VACATION_UPDATE',
                message: updateMsg,
                targetRole: request.user.role // This will show in their notification bell
            }
        });

        // 🟢 SEND PUSH TO USER
        sendPushToUser(request.user.id, {
            title: '📅 Actualización de Vacaciones',
            body: updateMsg,
            data: { url: '/dashboard/my-vacations' }
        }).catch(e => console.error("Push error User:", e.message));

        // If approved, notify Back Office
        if (status === 'APPROVED') {
            await prisma.notification.create({
                data: {
                    type: 'VACATION_APPROVED',
                    message: `Vacaciones aprobadas para ${request.user.username} (${request.startDate.toISOString().split('T')[0]} a ${request.endDate.toISOString().split('T')[0]})`,
                    targetRole: 'BACK_OFFICE'
                }
            });
            
            sendPushToRole('BACK_OFFICE', {
                title: '✅ Vacaciones Aprobadas',
                body: `Se han aprobado las vacaciones de ${request.user.username}.`,
                data: { url: '/dashboard/vacations-admin' }
            }).catch(e => console.error("Push error BO approved:", e.message));
        }

        res.json(request);
    } catch (error) {
        console.error('Error updating vacation status:', error);
        res.status(500).json({ message: 'Error al actualizar estado de vacaciones' });
    }
};

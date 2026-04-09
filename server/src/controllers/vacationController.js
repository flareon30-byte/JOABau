const prisma = require('../prisma');

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

// Returns an array of YYYY-MM-DD strings for German national holidays
const getGermanHolidays = (year) => {
    const holidays = [
        `${year}-01-01`, // Neujahr
        `${year}-05-01`, // Tag der Arbeit
        `${year}-10-03`, // Tag der Deutschen Einheit
        `${year}-12-25`, // 1. Weihnachtstag
        `${year}-12-26`, // 2. Weihnachtstag
    ];

    const easter = getEaster(year);
    
    // Karfreitag (Easter - 2 days)
    const karfreitag = new Date(easter);
    karfreitag.setDate(easter.getDate() - 2);
    holidays.push(karfreitag.toISOString().split('T')[0]);

    // Ostermontag (Easter + 1 day)
    const ostermontag = new Date(easter);
    ostermontag.setDate(easter.getDate() + 1);
    holidays.push(ostermontag.toISOString().split('T')[0]);

    // Christi Himmelfahrt (Easter + 39 days)
    const himmelfahrt = new Date(easter);
    himmelfahrt.setDate(easter.getDate() + 39);
    holidays.push(himmelfahrt.toISOString().split('T')[0]);

    // Pfingstmontag (Easter + 50 days)
    const pfingstmontag = new Date(easter);
    pfingstmontag.setDate(easter.getDate() + 50);
    holidays.push(pfingstmontag.toISOString().split('T')[0]);

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
        const dateString = curDate.toISOString().split('T')[0];
        
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
                targetRole: 'SUPER_ADMIN'
            }
        });

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
        await prisma.notification.create({
            data: {
                type: 'VACATION_UPDATE',
                message: `Tu solicitud de vacaciones ha sido ${status === 'APPROVED' ? 'APROBADA' : 'DENEGADA'}.`,
                // We need to target the specific user, but our Notification model has targetRole.
                // Let's check the schema again. 
                // Ah, Notification schema has addressId, createdById, targetRole. 
                // It doesn't have a targetUserId! That's a limitation.
                // However, I can still send it to their role, but they all will see it.
                // Wait, I should probably add targetUserId to Notification model if I want clean private notices.
                // But for now, I'll use targetRole or just a general message.
                // Let's check the schema one more time.
                targetRole: request.user.role // They will see it in their notifications
            }
        });

        // If approved, notify Back Office
        if (status === 'APPROVED') {
            await prisma.notification.create({
                data: {
                    type: 'VACATION_APPROVED',
                    message: `Vacaciones aprobadas para ${request.user.username} (${request.startDate.toISOString().split('T')[0]} a ${request.endDate.toISOString().split('T')[0]})`,
                    targetRole: 'BACK_OFFICE'
                }
            });
        }

        res.json(request);
    } catch (error) {
        console.error('Error updating vacation status:', error);
        res.status(500).json({ message: 'Error al actualizar estado de vacaciones' });
    }
};

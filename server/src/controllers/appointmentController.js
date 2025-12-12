const prisma = require('../prisma');

// Get addresses ready for appointment (Soplado OK, Appointment Pending/Null)
exports.getPendingAppointments = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                sopladoStatus: 'OK',
                AND: [
                    { clientName: { not: { startsWith: '***' } } }
                ],
                OR: [
                    { appointment: { is: null } },
                    { appointment: { status: 'PENDIENTE' } },
                    { appointment: { status: 'RECITAR' } }
                ]
            },
            include: {
                project: true,
                appointment: {
                    include: {
                        comments: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching pending appointments' });
    }
};

// Log a contact attempt
exports.logContactAttempt = async (req, res) => {
    const { addressId } = req.params;
    const { result, comment } = req.body; // result: "No contesta", "Equivocado", etc.
    const userId = req.userId; // From authMiddleware

    try {
        // Fetch user to get author name
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';
        const timestamp = new Date().toLocaleString();
        const historyEntry = `${timestamp}: ${result}`;

        // Upsert appointment to ensure it exists
        const appointment = await prisma.appointment.upsert({
            where: { addressId },
            update: {
                contactAttempts: { increment: 1 },
                contactHistory: { push: historyEntry },
                comments: comment ? {
                    create: { content: comment, authorName }
                } : undefined
            },
            create: {
                addressId,
                contactAttempts: 1,
                contactHistory: [historyEntry],
                comments: comment ? {
                    create: { content: comment, authorName }
                } : undefined
            }
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging contact attempt' });
    }
};

// Schedule an appointment
exports.scheduleAppointment = async (req, res) => {
    const { addressId } = req.params;
    const { date, teamId, clientName, apartmentCount } = req.body;

    if (!clientName || !apartmentCount) {
        return res.status(400).json({ message: 'El nombre del cliente y el número de apartamentos son obligatorios.' });
    }

    try {
        const appointment = await prisma.appointment.upsert({
            where: { addressId },
            update: {
                assignedDate: new Date(date),
                assignedTeamId: teamId,
                status: 'CITADO',
                clientName,
                apartmentCount: parseInt(apartmentCount)
            },
            create: {
                addressId,
                assignedDate: new Date(date),
                assignedTeamId: teamId,
                status: 'CITADO',
                clientName,
                apartmentCount: parseInt(apartmentCount)
            }
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error scheduling appointment' });
    }
};

// Get scheduled appointments (Calendar view - optional for now, but good to have)
exports.getScheduledAppointments = async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            where: {
                status: 'CITADO'
            },
            include: {
                address: {
                    include: { project: true }
                },
                assignedTeam: true
            },
            orderBy: { assignedDate: 'asc' }
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching scheduled appointments' });
    }
};
// Update appointment status (e.g., Protocol Terminado)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, comments, attendedBy } = req.body;
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';

        const updateData = {
            status,
        };

        if (comments || attendedBy) {
            const commentContent = [
                attendedBy ? `Atendido por: ${attendedBy}` : '',
                comments ? `Comentarios: ${comments}` : ''
            ].filter(Boolean).join('. ');

            if (commentContent) {
                updateData.comments = {
                    create: { content: commentContent, authorName }
                };
            }
        }

        const appointment = await prisma.appointment.update({
            where: { id },
            data: updateData
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating appointment status' });
    }
};

// Recite appointment (Request reschedule)
exports.reciteAppointment = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';

        const appointment = await prisma.appointment.update({
            where: { id },
            data: {
                status: 'RECITAR',
                comments: {
                    create: { content: `[RECITAR] Solicitud de recita: ${reason}`, authorName }
                }
            }
        });

        // Create Notification for Back Office
        // We target BACK_OFFICE as the primary recipient
        await prisma.notification.create({
            data: {
                type: 'RECITE_REQUEST',
                message: `Solicitud de recita: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`,
                addressId: appointment.addressId,
                createdById: userId,
                targetRole: 'BACK_OFFICE'
            }
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting recite request' });
    }
};

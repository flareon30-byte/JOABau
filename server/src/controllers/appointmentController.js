const prisma = require('../prisma');

// Get addresses ready for appointment (Soplado OK, Appointment Pending/Null)
exports.getPendingAppointments = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                AND: [
                    { clientName: { not: { startsWith: '***' } } },
                    { sopladoStatus: 'OK' },
                    { project: { isDemo: req.isDemo || false } },
                    { orderStatus: { notIn: ['CERRADA', 'DERIVADA'] } },
                    {
                        OR: [
                            { appointment: { is: null } },
                            { appointment: { status: 'PENDIENTE' } },
                            { appointment: { status: 'RECITAR' } }
                        ]
                    }
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

// Get escalated/derived/closed addresses
exports.getEscalatedAppointments = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                AND: [
                    { project: { isDemo: req.isDemo || false } },
                    { orderStatus: { in: ['CERRADA', 'DERIVADA'] } }
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
        res.status(500).json({ message: 'Error fetching escalated appointments' });
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
    const { date, teamId, clientName, apartmentCount, type = 'ACTIVATION' } = req.body;

    if (!clientName || !apartmentCount) {
        return res.status(400).json({ message: 'El nombre del cliente y el número de apartamentos son obligatorios.' });
    }

    try {
        // 1. Validation Logic
        const address = await prisma.address.findUnique({ where: { id: addressId } });

        if (!address) {
            return res.status(404).json({ message: 'Dirección no encontrada' });
        }

        // BLOCKING RULES
        if (type === 'ACTIVATION') {
            if (address.sopladoStatus !== 'OK') {
                return res.status(400).json({ message: 'Bloqueado: Esta dirección aún no tiene Soplado OK.' });
            }
            // Check protocol ONLY if required. "OK" or "COMPLETED" are valid success states (using "OK" for simplicity based on prompt)
            if (address.requiresProtocol && address.protocolStatus !== 'OK') {
                return res.status(400).json({ message: 'Bloqueado: Esta dirección require Protocolo OK antes de activar.' });
            }
        }

        // 2. Transaction to update Appointment and Address Status
        const userId = req.userId; // Who is scheduling this?

        const result = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.upsert({
                where: { addressId },
                update: {
                    assignedDate: new Date(date),
                    assignedTeamId: teamId,
                    status: 'CITADO',
                    clientName,
                    apartmentCount: parseInt(apartmentCount),
                    type,
                    scheduledById: userId // Track who made the appointment
                },
                create: {
                    addressId,
                    assignedDate: new Date(date),
                    assignedTeamId: teamId,
                    status: 'CITADO',
                    clientName,
                    apartmentCount: parseInt(apartmentCount),
                    type,
                    scheduledById: userId // Track who made the appointment
                }
            });

            // If scheduling a Protocol, update address status to imply it is in progress/scheduled
            if (type === 'PROTOCOL') {
                await tx.address.update({
                    where: { id: addressId },
                    data: { protocolStatus: 'SCHEDULED' }
                });
            }

            return appointment;
        });

        res.json(result);
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
                status: 'CITADO',
                address: { project: { isDemo: req.isDemo || false } }
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

// Manually update Protocol Status (Backoffice override)
exports.updateProtocolStatus = async (req, res) => {
    const { addressId } = req.params;
    const { status } = req.body; // 'OK', 'PENDING', 'NONE'

    try {
        const address = await prisma.address.update({
            where: { id: addressId },
            data: { protocolStatus: status }
        });
        res.json(address);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating protocol status' });
    }
};
// Cancel/Delete appointment
exports.deleteAppointment = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.appointment.delete({ where: { id } });
        res.json({ message: 'Cita eliminada y dirección devuelta a pendientes.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando cita' });
    }
};

// Update order status (for Derivar / Cerrar)
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const address = await prisma.address.update({
            where: { id },
            data: { orderStatus: status }
        });
        res.json(address);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating order status' });
    }
};

const prisma = require('../prisma');

exports.createRepairAppointment = async (req, res) => {
    const { addressId } = req.params;
    const { date, teamId, type, reason } = req.body; // type: 'WARRANTY' | 'BILLABLE'
    const userId = req.userId;

    if (!date || !teamId || !type) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';

        // Find existing appointment to preserve client name if possible
        const existingAppt = await prisma.appointment.findUnique({ where: { addressId } });
        const clientName = existingAppt?.clientName || 'Cliente Recuperado';
        const apartmentCount = existingAppt?.apartmentCount || 1;

        // Upsert appointment to schedule the repair
        // We use 'REPAIR_WARRANTY' or 'REPAIR_BILLABLE' as the appointment type string
        const repairType = type === 'WARRANTY' ? 'REPAIR_WARRANTY' : 'REPAIR_BILLABLE';

        const appointment = await prisma.appointment.upsert({
            where: { addressId },
            update: {
                assignedDate: new Date(date),
                assignedTeamId: teamId,
                status: 'CITADO', // Re-schedule
                type: repairType,
                scheduledById: userId,
                // Add log to comments
                comments: {
                    create: { content: reason ? `[REPARACIÓN CREADA]: ${reason} (${type})` : `[REPARACIÓN CREADA] Tipo: ${type}`, authorName }
                }
            },
            create: {
                addressId,
                assignedDate: new Date(date),
                assignedTeamId: teamId,
                status: 'CITADO',
                clientName,
                apartmentCount,
                type: repairType,
                scheduledById: userId,
                comments: {
                    create: { content: reason ? `[REPARACIÓN CREADA]: ${reason} (${type})` : `[REPARACIÓN CREADA] Tipo: ${type}`, authorName }
                }
            }
        });

        // Ensure Address status reflects this if needed (e.g. maybe set orderStatus to something?)
        // For now, we rely on Appointment Status 'CITADO' to show up in "Activaciones" list for the team.

        res.json({ message: 'Cita de reparación creada correctamente', appointment });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating repair appointment' });
    }
};

const prisma = require('../prisma');

// 1. Search for Address History
exports.searchAddressHistory = async (req, res) => {
    const { city, street, number } = req.query;

    if (!street) {
        return res.status(400).json({ message: 'La calle es obligatoria para buscar.' });
    }

    try {
        // Fuzzy search
        const addresses = await prisma.address.findMany({
            where: {
                street: { contains: street, mode: 'insensitive' },
                // Optional filters if provided
                ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
                ...(number ? { number: { contains: number, mode: 'insensitive' } } : {})
            },
            include: {
                project: true,
                sopladoInfo: true,
                appointment: {
                    include: {
                        assignedTeam: true,
                        scheduledBy: true
                    }
                },
                activationInfo: true // This contains closure photos/docs
            },
            take: 10 // Limit results
        });

        res.json(addresses);
    } catch (error) {
        console.error('Error searching address history:', error);
        res.status(500).json({ message: 'Error buscando historial.' });
    }
};

// 2. Create Manual Issue (Avería Externa)
exports.createManualIssue = async (req, res) => {
    const {
        city,
        street,
        number,
        clientName,
        teamId,
        date,
        description
    } = req.body;

    const userId = req.userId;

    if (!city || !street || !clientName || !teamId || !date) {
        return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    try {
        // A. Find or Create the Special Project "AVERIAS_EXTERNAS"
        let project = await prisma.project.findUnique({
            where: { name: 'AVERIAS_EXTERNAS' },
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: 'AVERIAS_EXTERNAS',
                    isDemo: false
                }
            });
        }

        // B. Create the Address
        // Note: We bypass strict NVT checks since this is an external repair
        const address = await prisma.address.create({
            data: {
                projectId: project.id,
                city,
                street,
                number: number || 'S/N',
                clientName,
                nvt: `REP-${Date.now().toString().slice(-6)}`, // Generate dummy NVT
                sopladoStatus: 'OK', // Assume physical infrastructure is there if it's a repair
                orderStatus: 'averia'
            }
        });

        // C. Create the Appointment directly
        const appointment = await prisma.appointment.create({
            data: {
                addressId: address.id,
                clientName,
                apartmentCount: 1,
                status: 'CITADO',
                assignedTeamId: teamId,
                assignedDate: new Date(date),
                type: 'REPAIR', // New Type
                scheduledById: userId,
                contactAttempts: 1,
                contactHistory: [`${new Date().toLocaleString()}: Avería registrada manualmente. ${description || ''}`],
                comments: description ? {
                    create: {
                        content: `Motivo Avería: ${description}`,
                        authorName: 'BackOffice'
                    }
                } : undefined
            }
        });

        // D. Create Notification for the assigned team
        if (teamId) {
            const team = await prisma.team.findUnique({
                where: { id: teamId },
                select: { department: true }
            });

            let targetRole = 'ACTIVATOR';
            if (team && team.department === 'BLOWING') targetRole = 'BLOWER';
            if (team && team.department === 'PROTOCOLS') targetRole = 'PROTOCOL_MANAGER';

            await prisma.notification.create({
                data: {
                    type: 'REPAIR_ASSIGNED',
                    message: `Nueva avería asignada: ${street} ${number} - ${description || 'Sin detalles'}`,
                    createdById: userId,
                    addressId: address.id,
                    targetRole: targetRole
                }
            });
        }

        res.json({ message: 'Avería creada correctamente', address, appointment });

    } catch (error) {
        console.error('Error creating manual issue:', error);
        res.status(500).json({ message: 'Error creando la avería.' });
    }
};

// 3. Create Issue from Existing Address
exports.createFromExisting = async (req, res) => {
    const { addressId, teamId, date, description, clientName } = req.body;
    const userId = req.userId;

    if (!addressId || !teamId || !date) {
        return res.status(400).json({ message: 'Faltan datos obligatorios (Dirección, Equipo, Fecha).' });
    }

    try {
        // Check if there is already an active appointment? 
        // For repairs, we might allow multiple, but usually we just want one active.
        // For simplicity, we create a new appointment of type REPAIR.

        // First, update client name if provided (often updated during trouble calls)
        if (clientName) {
            await prisma.address.update({
                where: { id: addressId },
                data: { clientName }
            });
        }

        // Get address details for notification
        const address = await prisma.address.findUnique({ where: { id: addressId } });

        // Upsert appointment? Or just create a new one?
        // If we use 'addressId' as unique in Appointment schema, we must update the existing one or delete/archive it.
        // The schema says: addressId String @unique. So we can only have ONE active appointment per address.
        // We should OVERWRITE the existing appointment (or update it) to be a Repair.

        const appointment = await prisma.appointment.upsert({
            where: { addressId: addressId },
            update: {
                status: 'CITADO',
                assignedTeamId: teamId,
                assignedDate: new Date(date),
                type: 'REPAIR',
                scheduledById: userId,
                // Append to contact history
                // contactHistory: { push:  ... } // Prisma doesn't support simple push easily depending on DB, but let's try raw update later if needed.
                // For now, simple update fields:
                updatedAt: new Date(),
                comments: {
                    create: {
                        content: `RECLAMACIÓN/AVERÍA: ${description}`,
                        authorName: 'BackOffice'
                    }
                }
            },
            create: {
                addressId: addressId,
                clientName: clientName || address.clientName || 'Sin Nombre',
                apartmentCount: 1,
                status: 'CITADO',
                assignedTeamId: teamId,
                assignedDate: new Date(date),
                type: 'REPAIR',
                scheduledById: userId,
                comments: {
                    create: {
                        content: `RECLAMACIÓN/AVERÍA: ${description}`,
                        authorName: 'BackOffice'
                    }
                }
            }
        });

        // Determine Target Role based on Team Department
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { department: true }
        });

        let targetRole = 'ACTIVATOR'; // Default
        if (team && team.department === 'BLOWING') targetRole = 'BLOWER';
        if (team && team.department === 'PROTOCOLS') targetRole = 'PROTOCOL_MANAGER';

        // Add Notification
        await prisma.notification.create({
            data: {
                type: 'REPAIR_ASSIGNED',
                message: `URGENTE RECLAMACIÓN: ${address.street} ${address.number} - ${description}`,
                createdById: userId,
                addressId: addressId,
                targetRole: targetRole
            }
        });

        res.json({ message: 'Reclamación creada y asignada exitosamente.', appointment });

    } catch (error) {
        console.error('Error creating issue from existing:', error);
        res.status(500).json({ message: 'Error al crear reclamación.' });
    }
};

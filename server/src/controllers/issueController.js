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
            const teamWithMembers = await prisma.team.findUnique({
                where: { id: teamId },
                include: { users: true }
            });

            if (teamWithMembers && teamWithMembers.users.length > 0) {
                const notifications = teamWithMembers.users.map(user => ({
                    type: 'REPAIR_ASSIGNED',
                    message: `Nueva avería asignada: ${street} ${number} - ${description || 'Sin detalles'}`,
                    createdById: userId,
                    addressId: address.id,
                    userId: user.id
                }));

                await prisma.notification.createMany({
                    data: notifications
                });
            } else {
                // Fallback if no users in team
                let targetRole = 'ACTIVATOR';
                if (teamWithMembers && teamWithMembers.department === 'BLOWING') targetRole = 'BLOWER';
                if (teamWithMembers && teamWithMembers.department === 'PROTOCOLS') targetRole = 'PROTOCOL_MANAGER';

                await prisma.notification.create({
                    data: {
                        type: 'REPAIR_ASSIGNED',
                        message: `Nueva avería asignada: ${street} ${number} - ${description || 'Sin detalles'} (Sin usuarios)`,
                        createdById: userId,
                        addressId: address.id,
                        targetRole: targetRole
                    }
                });
            }
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

        // Notify Team Members Specifically
        const teamWithMembers = await prisma.team.findUnique({
            where: { id: teamId },
            include: { users: true }
        });

        if (teamWithMembers && teamWithMembers.users.length > 0) {
            // Create notification for each member
            const notifications = teamWithMembers.users.map(user => ({
                type: 'REPAIR_ASSIGNED',
                message: `URGENTE RECLAMACIÓN: ${address.street} ${address.number}\n${description}`,
                createdById: userId,
                addressId: addressId,
                userId: user.id // Specific user
            }));

            await prisma.notification.createMany({
                data: notifications
            });
        } else {
            // Fallback to Role if no members found (unlikely but safe)
            let targetRole = 'ACTIVATOR';
            if (teamWithMembers && teamWithMembers.department === 'BLOWING') targetRole = 'BLOWER';
            if (teamWithMembers && teamWithMembers.department === 'PROTOCOLS') targetRole = 'PROTOCOL_MANAGER';

            await prisma.notification.create({
                data: {
                    type: 'REPAIR_ASSIGNED',
                    message: `URGENTE RECLAMACIÓN: ${address.street} ${address.number} - ${description} (Sin usuarios en equipo)`,
                    createdById: userId,
                    addressId: addressId,
                    targetRole: targetRole
                }
            });
        }

        res.json({ message: 'Reclamación creada y asignada exitosamente.', appointment });

    } catch (error) {
        console.error('Error creating issue from existing:', error);
        res.status(500).json({ message: 'Error al crear reclamación.' });
    }
};

// 4. Submit Repair (Technician View)
exports.submitRepair = async (req, res) => {
    const { addressId } = req.params;
    const { description } = req.body;
    const userId = req.userId;

    // Photos handling from multer
    // req.files is array of files
    const photos = req.files ? req.files.map(f => f.path.replace(/\\/g, '/')) : [];

    if (!description) {
        return res.status(400).json({ message: 'La descripción de la reparación es obligatoria.' });
    }

    try {
        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create Repair Record
            const repair = await prisma.repair.create({
                data: {
                    addressId,
                    description,
                    photos,
                    technicianId: userId
                }
            });

            // 2. Update Appointment Status to COMPLETED
            await prisma.appointment.update({
                where: { addressId },
                data: {
                    status: 'COMPLETADO',
                    contactHistory: {
                        push: `${new Date().toLocaleString()}: Reparación completada por técnico.`
                    }
                }
            });

            // 3. Notify Admins/BackOffice (Optional but good)
            const address = await prisma.address.findUnique({ where: { id: addressId } });
            await prisma.notification.create({
                data: {
                    type: 'REPAIR_COMPLETED',
                    message: `Reparación completada: ${address.street} - ${description}`,
                    addressId,
                    targetRole: 'BACK_OFFICE', // or ADMIN
                    createdById: userId
                }
            });

            return repair;
        });

        res.json({ message: 'Reparación guardada correctamente.', result });

    } catch (error) {
        console.error('Error submitting repair:', error);
        res.status(500).json({ message: 'Error al guardar la reparación.' });
    }
};

// 5. Get All Repairs (Admin/BackOffice View)
exports.getRepairs = async (req, res) => {
    const { status, startDate, endDate } = req.query;

    try {
        let data = [];

        // Date Filtering Helper
        const dateFilter = (startDate && endDate) ? {
            assignedDate: { // For Appointments
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        } : {};

        const repairDateFilter = (startDate && endDate) ? {
            createdAt: { // For Repairs
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        } : {};


        if (status === 'PENDING') {
            // Fetch PENDING REPAIRS from Appointments table
            data = await prisma.appointment.findMany({
                where: {
                    type: 'REPAIR',
                    status: { not: 'COMPLETADO' },
                    ...dateFilter
                },
                include: {
                    address: { include: { project: true } },
                    assignedTeam: true
                },
                orderBy: { assignedDate: 'asc' }
            });
        } else if (status === 'COMPLETED') {
            // Fetch COMPLETED REPAIRS from Repair table
            data = await prisma.repair.findMany({
                where: {
                    ...repairDateFilter
                },
                include: {
                    address: {
                        include: {
                            project: true,
                            appointment: { include: { assignedTeam: true } }
                        }
                    },

                },
                orderBy: { createdAt: 'desc' }, // Newest first
                take: 100
            });

            // Allow fetching technician name via user lookup if needed, but not direct relation in schema yet?
            // Schema: technicianId String? // ID of who performed the repair
            // We should fetch User info manually or include it if relation existed.
            // Since no direct relation in schema for technicianId -> User, we'll fetch users separately or just use ID for now.
            // Actually, let's fix schema if we want the name easily?
            // But user didn't ask for schema change for User relation, just "stored so admin can see".
            // I'll stick to technicianId for now, admin can probably map it or see it.
        } else {
            // Fetch ALL (Maybe mixed? or just default to pending?)
            // Let's just return both in separate keys or just valid structure.
            // If no status, maybe just return Pending by default.
            data = await prisma.appointment.findMany({
                where: {
                    type: 'REPAIR',
                    status: { not: 'COMPLETADO' },
                },
                include: {
                    address: { include: { project: true } },
                    assignedTeam: true
                },
                orderBy: { assignedDate: 'asc' }
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Error fetching repairs:', error);
        res.status(500).json({ message: 'Error obteniendo reparaciones' });
    }
};

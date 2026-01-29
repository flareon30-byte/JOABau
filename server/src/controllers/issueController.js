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
            where: { name: 'AVERIAS_EXTERNAS' }
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

        res.json({ message: 'Avería creada correctamente', address, appointment });

    } catch (error) {
        console.error('Error creating manual issue:', error);
        res.status(500).json({ message: 'Error creando la avería.' });
    }
};

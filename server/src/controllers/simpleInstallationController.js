const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createInstallation = async (req, res) => {
    try {
        const { projectId, contactName, comments, addressInfo } = req.body;
        const photos = req.files || [];
        const userId = req.userId;

        // Parse address info
        const parsedAddress = JSON.parse(addressInfo);

        // 1. Get or create the address under a generic G&K project, or if they passed projectId use it.
        // If not, maybe create a temporary project or we use a "Sin Proyecto" dummy project.
        // For now, we assume projectId is provided or we fetch a default one for this active client.
        let targetProjectId = projectId;
        if (!targetProjectId) {
            // Find a generic project for the current user's active client
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { 
                    activeClientCompany: true,
                    team: { include: { activeClientCompany: true } }
                }
            });
            
            const activeClient = user.activeClientCompany || (user.team ? user.team.activeClientCompany : null);
            const activeClientId = activeClient ? activeClient.id : null;
            const clientName = activeClient ? activeClient.name : 'General';

            let dummyProject = await prisma.project.findFirst({
                where: { name: `Proyectos Varios - ${clientName}` }
            });
            if (!dummyProject) {
                dummyProject = await prisma.project.create({
                    data: {
                        name: `Proyectos Varios - ${clientName}`,
                        clientCompanyId: activeClientId
                    }
                });
            }
            targetProjectId = dummyProject.id;
        }

        const address = await prisma.address.create({
            data: {
                projectId: targetProjectId,
                street: parsedAddress.street,
                number: parsedAddress.number,
                city: parsedAddress.city,
            }
        });

        // Photos mapping
        const photoUrls = photos.map(file => `/uploads/${file.filename}`);

        // Create the SimpleInstallation record
        const installation = await prisma.simpleInstallation.create({
            data: {
                addressId: address.id,
                contactName,
                comments,
                photos: photoUrls,
                createdById: userId,
                // priceCharged would be computed based on active client settings here if needed
                priceCharged: 0 // Placeholder, could be from user.activeClientCompany.settings.ApLPrice
            }
        });

        res.status(201).json({ message: 'Installation recorded successfully', installation });
    } catch (error) {
        console.error('Error creating simple installation:', error);
        res.status(500).json({ message: 'Error processing installation' });
    }
};

exports.getInstallations = async (req, res) => {
    try {
        const installations = await prisma.simpleInstallation.findMany({
            include: { address: true, createdBy: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(installations);
    } catch (error) {
        console.error('Error fetching installations:', error);
        res.status(500).json({ message: 'Error fetching installations' });
    }
};

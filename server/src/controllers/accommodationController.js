const prisma = require('../prisma');

// Get all accommodations
exports.getAllAccommodations = async (req, res) => {
    try {
        const accommodations = await prisma.accommodation.findMany({
            include: {
                residents: {
                    select: {
                        id: true,
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(accommodations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los alojamientos' });
    }
};

// Get accommodation by ID
exports.getAccommodationById = async (req, res) => {
    const { id } = req.params;
    try {
        const accommodation = await prisma.accommodation.findUnique({
            where: { id },
            include: {
                residents: {
                    select: {
                        id: true,
                        username: true,
                        role: true
                    }
                }
            }
        });
        if (!accommodation) {
            return res.status(404).json({ message: 'Alojamiento no encontrado' });
        }
        res.json(accommodation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los detalles del alojamiento' });
    }
};

// Create accommodation
exports.createAccommodation = async (req, res) => {
    const { address, startDate, endDate, residentIds } = req.body;

    if (!address || !startDate || !endDate) {
        return res.status(400).json({ message: 'La dirección y las fechas de inicio y fin son obligatorias.' });
    }

    try {
        const data = {
            address,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        };

        if (residentIds && Array.isArray(residentIds)) {
            data.residents = {
                connect: residentIds.map(id => ({ id }))
            };
        }

        const accommodation = await prisma.accommodation.create({
            data,
            include: {
                residents: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
        res.status(201).json(accommodation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear el alojamiento' });
    }
};

// Update accommodation
exports.updateAccommodation = async (req, res) => {
    const { id } = req.params;
    const { address, startDate, endDate, residentIds } = req.body;

    if (!address || !startDate || !endDate) {
        return res.status(400).json({ message: 'La dirección y las fechas de inicio y fin son obligatorias.' });
    }

    try {
        const updateData = {
            address,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
        };

        if (residentIds && Array.isArray(residentIds)) {
            updateData.residents = {
                set: residentIds.map(id => ({ id }))
            };
        }

        const accommodation = await prisma.accommodation.update({
            where: { id },
            data: updateData,
            include: {
                residents: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            }
        });
        res.json(accommodation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar el alojamiento' });
    }
};

// Delete accommodation
exports.deleteAccommodation = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.accommodation.delete({
            where: { id }
        });
        res.json({ message: 'Alojamiento eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar el alojamiento' });
    }
};

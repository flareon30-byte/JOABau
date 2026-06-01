const prisma = require('../prisma');

exports.getAllSubcontractors = async (req, res) => {
    try {
        const subcontractors = await prisma.subcontractor.findMany({
            include: {
                _count: {
                    select: {
                        projects: true,
                        users: true,
                        dailyReports: true
                    }
                },
                projects: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                users: {
                    select: {
                        id: true,
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(subcontractors);
    } catch (error) {
        console.error('Error fetching subcontractors:', error);
        res.status(500).json({ message: 'Error al obtener las subcontratas' });
    }
};

exports.getSubcontractorById = async (req, res) => {
    const { id } = req.params;
    try {
        const subcontractor = await prisma.subcontractor.findUnique({
            where: { id },
            include: {
                projects: true,
                users: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        phone: true
                    }
                }
            }
        });
        if (!subcontractor) {
            return res.status(404).json({ message: 'Subcontrata no encontrada' });
        }
        res.json(subcontractor);
    } catch (error) {
        console.error('Error fetching subcontractor:', error);
        res.status(500).json({ message: 'Error al obtener la subcontrata' });
    }
};

exports.createSubcontractor = async (req, res) => {
    const { name, responsible, phone, email, peopleCount, projectIds } = req.body;
    try {
        const subcontractor = await prisma.subcontractor.create({
            data: {
                name,
                responsible: responsible || null,
                phone: phone || null,
                email: email || null,
                peopleCount: peopleCount ? parseInt(peopleCount) : 0
            }
        });

        // Assign projects if provided
        if (projectIds && Array.isArray(projectIds) && projectIds.length > 0) {
            await prisma.project.updateMany({
                where: { id: { in: projectIds } },
                data: { subcontractorId: subcontractor.id }
            });
        }

        res.status(201).json(subcontractor);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Ya existe una subcontrata con ese nombre' });
        }
        console.error('Error creating subcontractor:', error);
        res.status(500).json({ message: 'Error al crear la subcontrata' });
    }
};

exports.updateSubcontractor = async (req, res) => {
    const { id } = req.params;
    const { name, responsible, phone, email, peopleCount, projectIds } = req.body;
    try {
        const subcontractor = await prisma.subcontractor.update({
            where: { id },
            data: {
                name,
                responsible: responsible || null,
                phone: phone || null,
                email: email || null,
                peopleCount: peopleCount ? parseInt(peopleCount) : 0
            }
        });

        if (projectIds && Array.isArray(projectIds)) {
            // First, clear previous project assignments for this subcontrata
            await prisma.project.updateMany({
                where: { subcontractorId: id },
                data: { subcontractorId: null }
            });

            // Then assign the new ones
            if (projectIds.length > 0) {
                await prisma.project.updateMany({
                    where: { id: { in: projectIds } },
                    data: { subcontractorId: id }
                });
            }
        }

        res.json(subcontractor);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Ya existe una subcontrata con ese nombre' });
        }
        console.error('Error updating subcontractor:', error);
        res.status(500).json({ message: 'Error al actualizar la subcontrata' });
    }
};

exports.deleteSubcontractor = async (req, res) => {
    const { id } = req.params;
    try {
        // Disassociate projects and users first
        await prisma.project.updateMany({
            where: { subcontractorId: id },
            data: { subcontractorId: null }
        });

        await prisma.user.updateMany({
            where: { subcontractorId: id },
            data: { subcontractorId: null }
        });

        await prisma.subcontractor.delete({ where: { id } });
        res.json({ message: 'Subcontrata eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting subcontractor:', error);
        res.status(500).json({ message: 'Error al eliminar la subcontrata' });
    }
};

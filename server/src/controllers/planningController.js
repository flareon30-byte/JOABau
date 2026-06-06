const prisma = require('../prisma');

exports.getPlannedWorks = async (req, res) => {
    try {
        const { projectId } = req.params;
        const works = await prisma.plannedWork.findMany({
            where: { projectId },
            include: {
                assignedTo: true,
                createdBy: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(works);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch planned works' });
    }
};

exports.createPlannedWork = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { items } = req.body; // Expecting an array of planned items
        const userId = req.user.userId;

        const createdItems = await prisma.$transaction(
            items.map(item => prisma.plannedWork.create({
                data: {
                    projectId,
                    type: item.type,
                    coordinates: item.coordinates,
                    deadline: item.deadline ? new Date(item.deadline) : null,
                    notes: item.notes,
                    createdById: userId,
                    status: 'PENDING'
                }
            }))
        );

        res.status(201).json(createdItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create planned works' });
    }
};

exports.updatePlannedWork = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assignedToId, deadline, notes, coordinates } = req.body;

        const updated = await prisma.plannedWork.update({
            where: { id },
            data: {
                status,
                assignedToId,
                deadline: deadline ? new Date(deadline) : undefined,
                notes,
                coordinates
            },
            include: {
                assignedTo: true,
                createdBy: { select: { username: true } }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update planned work' });
    }
};

exports.deletePlannedWork = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.plannedWork.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete planned work' });
    }
};

exports.getExecutiveDashboardData = async (req, res) => {
    try {
        // Obtenemos progreso de todos los proyectos activos
        const projects = await prisma.project.findMany({
            include: {
                _count: {
                    select: { addresses: true }
                }
            }
        });

        const dashboardData = await Promise.all(projects.map(async (project) => {
            const plannedWorks = await prisma.plannedWork.findMany({
                where: { projectId: project.id }
            });

            const total = plannedWorks.length;
            const completed = plannedWorks.filter(w => w.status === 'COMPLETED').length;
            const pending = plannedWorks.filter(w => w.status === 'PENDING').length;
            const assigned = plannedWorks.filter(w => w.status === 'ASSIGNED').length;
            const overdue = plannedWorks.filter(w => w.status === 'OVERDUE' || (w.deadline && new Date(w.deadline) < new Date() && w.status !== 'COMPLETED')).length;

            const brechasCount = plannedWorks.filter(w => w.type === 'BRECHA').length;
            const brechasResueltas = plannedWorks.filter(w => w.type === 'BRECHA' && w.status === 'COMPLETED').length;

            // Calculate real acometidas from Address model
            const completedAcometidas = await prisma.address.count({
                where: { projectId: project.id, civilWorkStatus: 'HECHO' }
            });

            const activations = await prisma.activationInfo.count({
                where: { address: { projectId: project.id } }
            });

            return {
                id: project.id,
                name: project.name,
                stats: {
                    total,
                    completed,
                    pending,
                    assigned,
                    overdue,
                    progress: total > 0 ? (completed / total) * 100 : 0,
                    brechasCount,
                    brechasResueltas,
                    completedAcometidas,
                    totalAcometidas: project._count.addresses,
                    activations
                }
            };
        }));

        res.json(dashboardData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate executive dashboard data' });
    }
};

exports.getMyPlannedWorks = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        
        let whereClause = {};
        
        if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
            whereClause = {};
        } else {
            const userWithProjects = await prisma.user.findUnique({
                where: { id: userId },
                include: { projects: true }
            });
            if (!userWithProjects || !userWithProjects.projects) {
                return res.json([]);
            }
            const projectIds = userWithProjects.projects.map(p => p.id);
            whereClause = { projectId: { in: projectIds } };
        }

        const works = await prisma.plannedWork.findMany({
            where: whereClause,
            include: {
                project: { select: { name: true } },
                assignedTo: true,
                createdBy: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(works);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch my planned works' });
    }
};

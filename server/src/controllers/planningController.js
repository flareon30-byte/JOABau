const prisma = require('../prisma');

exports.debugSub = async (req, res) => {
    try {
        const user = await prisma.user.findFirst({ where: { username: 'Antonio' }, include: { subcontractor: true } });
        const subId = user ? user.subcontractorId : 'USER_NOT_FOUND';
        
        const proj = await prisma.project.findFirst({ where: { name: 'Gau-Bickelheim' }, include: { subcontractor: true } });
        
        const works = await prisma.plannedWork.findMany({ 
            include: { assignedTo: true, project: true }
        });

        res.json({
            user: { username: user?.username, role: user?.role, subId, subName: user?.subcontractor?.name },
            project: { id: proj?.id, name: proj?.name, subId: proj?.subcontractorId },
            works: works.map(w => ({ id: w.id, type: w.type, projId: w.projectId, projName: w.project?.name, assignedToId: w.assignedToId, assignedToName: w.assignedTo?.name }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPlannedWorks = async (req, res) => {
    try {
        const { projectId } = req.params;
        let whereClause = { projectId };
        
        // Filter by user role if it's a subcontractor
        if (req.userId) {
            const user = await prisma.user.findUnique({ where: { id: req.userId } });
            if (user && user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
                whereClause.assignedToId = user.subcontractorId;
            }
        }

        const works = await prisma.plannedWork.findMany({
            where: whereClause,
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
        const userId = req.userId;

        const createdItems = await prisma.$transaction(
            items.map(item => prisma.plannedWork.create({
                data: {
                    projectId,
                    type: item.type,
                    coordinates: item.coordinates,
                    deadline: item.deadline ? new Date(item.deadline) : null,
                    notes: item.notes,
                    assignedToId: item.assignedToId || null,
                    createdById: userId,
                    status: 'PENDING'
                }
            }))
        );

        // Fetch project to get its name and assigned managers
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                users: {
                    where: {
                        role: {
                            in: ['PROJECT_MANAGER', 'SITE_MANAGER']
                        }
                    }
                }
            }
        });

        if (project && project.users && project.users.length > 0) {
            const notifications = project.users.map(u => ({
                type: 'PLANNING',
                message: `Se ha planificado un nuevo trabajo (${items[0]?.type || 'Trabajo'}) en el proyecto ${project.name}.`,
                targetUserId: u.id,
                createdById: userId,
                relatedEntityId: createdItems[0]?.id
            }));
            await prisma.notification.createMany({
                data: notifications
            });
        }

        // Notify subcontractors if any items were assigned
        const assignedItems = createdItems.filter(i => i.assignedToId);
        for (const item of assignedItems) {
            const subUsers = await prisma.user.findMany({ where: { subcontractorId: item.assignedToId } });
            if (subUsers.length > 0) {
                const subNotifications = subUsers.map(u => ({
                    type: 'PLANNING_ASSIGNED',
                    message: `Se te ha asignado un nuevo trabajo (${item.type}) en el proyecto ${project.name}.`,
                    targetUserId: u.id,
                    createdById: userId,
                    relatedEntityId: item.id
                }));
                await prisma.notification.createMany({ data: subNotifications });
            }
        }

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

        const existingWork = await prisma.plannedWork.findUnique({ where: { id } });

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

        if (assignedToId && existingWork && existingWork.assignedToId !== assignedToId) {
            const subUsers = await prisma.user.findMany({ where: { subcontractorId: assignedToId } });
            if (subUsers.length > 0) {
                const project = await prisma.project.findUnique({ where: { id: updated.projectId } });
                const notifications = subUsers.map(u => ({
                    type: 'PLANNING_ASSIGNED',
                    message: `Se te ha asignado un nuevo trabajo (${updated.type}) en el proyecto ${project?.name || 'Asignado'}.`,
                    targetUserId: u.id,
                    createdById: req.userId,
                    relatedEntityId: updated.id
                }));
                await prisma.notification.createMany({ data: notifications });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update planned work' });
    }
};

exports.submitPlannedWork = async (req, res) => {
    try {
        const { id } = req.params;
        const { photos, distance, actualCoordinates, comments } = req.body;

        const work = await prisma.plannedWork.findUnique({
            where: { id },
            include: { project: true }
        });

        if (!work) return res.status(404).json({ error: 'Not found' });

        const updateData = {
            status: 'PENDING_REVISION',
            photos: photos || [],
            distance: distance || null,
            incorrectPhotos: [], // Clear any previous rejections
        };

        // Save actual GPS path if provided (from AI or manual GPS)
        if (actualCoordinates && Array.isArray(actualCoordinates) && actualCoordinates.length > 0) {
            updateData.actualCoordinates = actualCoordinates;
        }

        // Save comments if provided
        if (comments) {
            updateData.notes = work.notes ? `${work.notes}\n[Subcontrata]: ${comments}` : `[Subcontrata]: ${comments}`;
        }

        const updated = await prisma.plannedWork.update({
            where: { id },
            data: updateData
        });

        // Notify SITE_MANAGER and PROJECT_MANAGER
        const managers = await prisma.user.findMany({
            where: {
                role: { in: ['PROJECT_MANAGER', 'SITE_MANAGER'] }
            }
        });

        if (managers.length > 0) {
            const notifications = managers.map(m => ({
                type: 'PLANNING_REVIEW',
                message: `La subcontrata ha enviado a revisión el trabajo (${work.type}) del proyecto ${work.project.name}.`,
                targetUserId: m.id,
                createdById: req.userId,
                relatedEntityId: id
            }));
            await prisma.notification.createMany({ data: notifications });
        }

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit planned work' });
    }
};

exports.approvePlannedWork = async (req, res) => {
    try {
        const { id } = req.params;

        const work = await prisma.plannedWork.findUnique({
            where: { id },
            include: { project: true }
        });

        if (!work) return res.status(404).json({ error: 'Not found' });

        const updated = await prisma.plannedWork.update({
            where: { id },
            data: { status: 'COMPLETED' }
        });

        if (work.assignedToId) {
            const subUsers = await prisma.user.findMany({ where: { subcontractorId: work.assignedToId } });
            if (subUsers.length > 0) {
                const notifications = subUsers.map(u => ({
                    type: 'PLANNING_APPROVED',
                    message: `Tu trabajo (${work.type}) en ${work.project.name} ha sido aprobado.`,
                    targetUserId: u.id,
                    createdById: req.userId,
                    relatedEntityId: id
                }));
                await prisma.notification.createMany({ data: notifications });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to approve planned work' });
    }
};

exports.rejectPlannedWork = async (req, res) => {
    try {
        const { id } = req.params;
        const { incorrectPhotos, reviewComments } = req.body;

        const work = await prisma.plannedWork.findUnique({
            where: { id },
            include: { project: true }
        });

        if (!work) return res.status(404).json({ error: 'Not found' });

        const updated = await prisma.plannedWork.update({
            where: { id },
            data: {
                status: 'RETURNED',
                incorrectPhotos,
                reviewComments
            }
        });

        if (work.assignedToId) {
            const subUsers = await prisma.user.findMany({ where: { subcontractorId: work.assignedToId } });
            if (subUsers.length > 0) {
                const notifications = subUsers.map(u => ({
                    type: 'PLANNING_REJECTED',
                    message: `Tu trabajo (${work.type}) en ${work.project.name} requiere correcciones.`,
                    targetUserId: u.id,
                    createdById: req.userId,
                    relatedEntityId: id
                }));
                await prisma.notification.createMany({ data: notifications });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to reject planned work' });
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

            const activations = await prisma.address.count({
                where: { projectId: project.id, orderStatus: 'Installiert' }
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

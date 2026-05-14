const prisma = require('../prisma');
const { processImages } = require('../utils/imageProcessor');

// Log Fusion Work (New Workflow)
exports.logFusionWork = async (req, res) => {
    const { projectId, nvt, type, address, hours, fusionCount, isTray, description } = req.body;
    const files = req.files;
    const userId = req.userId;

    if (!projectId || (!nvt && type !== 'MUFFA') || !fusionCount) {
        return res.status(400).json({ message: 'Project ID, NVT (if NVT type), and Fusion Count are required' });
    }

    // 🟢 COMPRESIÓN DE IMÁGENES
    if (files && files.length > 0) {
        const techUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
        const techName = techUser?.username || 'Técnico JOA';
        await processImages(files, techName);
    }

    try {
        const photoPaths = files ? files.map(f => f.path) : [];

        const work = await prisma.fusionWork.create({
            data: {
                projectId,
                nvtName: nvt || null,
                type: type || 'NVT',
                address: address || null,
                hours: hours ? parseFloat(hours) : null,
                fusionCount: parseInt(fusionCount),
                isTray: isTray === 'true' || isTray === true,
                description,
                photos: photoPaths,
                createdById: userId
            }
        });

        res.json(work);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging fusion work' });
    }
};

// Get fusion works
exports.getFusionWorks = async (req, res) => {
    const { projectId } = req.params;
    const { nvt, type } = req.query;

    try {
        const where = { projectId };
        
        if (type) {
            where.type = type;
        }
        
        if (nvt) {
            where.nvtName = { equals: nvt, mode: 'insensitive' };
        }

        const works = await prisma.fusionWork.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(works);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching fusion works' });
    }
};

// Update Fusion Work
exports.updateFusionWork = async (req, res) => {
    const { id } = req.params;
    const { fusionCount, isTray, description, address, hours, existingPhotos } = req.body;
    const files = req.files;
    const userId = req.userId;

    try {
        const existingWork = await prisma.fusionWork.findUnique({ where: { id } });
        if (!existingWork) return res.status(404).json({ message: 'Work not found' });

        // Check ownership or admin status if needed, but for now allow technician who created it
        // Or any authorized technician for that project.

        let photoPaths = [];
        if (existingPhotos) {
            photoPaths = JSON.parse(existingPhotos);
        }

        if (files && files.length > 0) {
            const techUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
            const techName = techUser?.username || 'Técnico JOA';
            await processImages(files, techName);
            const newPhotoPaths = files.map(f => f.path);
            photoPaths = [...photoPaths, ...newPhotoPaths];
        }

        const updated = await prisma.fusionWork.update({
            where: { id },
            data: {
                fusionCount: fusionCount ? parseInt(fusionCount) : undefined,
                isTray: isTray !== undefined ? (isTray === 'true' || isTray === true) : undefined,
                description: description !== undefined ? description : undefined,
                address: address !== undefined ? address : undefined,
                hours: hours ? parseFloat(hours) : undefined,
                photos: photoPaths
            }
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating fusion work' });
    }
};

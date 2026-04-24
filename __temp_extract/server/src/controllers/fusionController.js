const prisma = require('../prisma');
const { processImages } = require('../utils/imageProcessor');

// Log Fusion Work (New Workflow)
exports.logFusionWork = async (req, res) => {
    const { projectId, nvt, fusionCount, isTray, description } = req.body;
    const files = req.files;
    const userId = req.userId;

    if (!projectId || !nvt || !fusionCount) {
        return res.status(400).json({ message: 'Project ID, NVT, and Fusion Count are required' });
    }

    // 🟢 COMPRESIÓN DE IMÁGENES
    if (files && files.length > 0) {
        await processImages(files);
    }

    try {
        const photoPaths = files ? files.map(f => f.path) : [];

        const work = await prisma.fusionWork.create({
            data: {
                projectId,
                nvtName: nvt,
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
    const { nvt } = req.query;

    try {
        const where = { projectId };
        // nvtName is case sensitive usually, but NVT names should be standardized. 
        // We can use insensitive if we want.
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

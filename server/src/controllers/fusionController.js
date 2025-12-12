const prisma = require('../prisma');

// Submit Fusion Report
exports.submitFusionReport = async (req, res) => {
    const { addressId } = req.params;
    const { description } = req.body;
    const files = req.files; // Array of files from multer

    try {
        const photoPaths = files ? files.map(f => f.path) : [];

        // Transaction to ensure consistency
        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create or Update FusionInfo
            const fusionInfo = await prisma.fusionInfo.upsert({
                where: { addressId },
                update: {
                    description,
                    photos: photoPaths
                },
                create: {
                    addressId,
                    description,
                    photos: photoPaths
                }
            });

            return fusionInfo;
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting fusion report' });
    }
};

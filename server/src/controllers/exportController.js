const prisma = require('../prisma');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

exports.exportActivationPhotos = async (req, res) => {
    const { projectId, startDate, endDate } = req.query;

    console.log('Exporting photos with filters:', { projectId, startDate, endDate });

    try {
        // Build filters
        const whereClause = {
            photos: { isEmpty: false }
        };

        const addressWhere = {};
        if (projectId) addressWhere.projectId = projectId;

        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        } else if (startDate) {
            whereClause.createdAt = {
                gte: new Date(startDate)
            };
        } else if (endDate) {
            whereClause.createdAt = {
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        const activations = await prisma.activationInfo.findMany({
            where: {
                ...whereClause,
                address: addressWhere
            },
            include: {
                address: true
            }
        });

        if (activations.length === 0) {
            return res.status(404).send('No se encontraron activaciones con fotos en este rango.');
        }

        // Create Zip
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        res.attachment('activation_photos.zip');
        archive.pipe(res);

        for (const act of activations) {
            const address = act.address;
            // Clean folder name
            const folderName = `${address.street} ${address.number || ''} - ${address.clientName || 'Sin Cliente'}`
                .trim()
                .replace(/[\\/:*?"<>|]/g, '_');

            for (const photoPath of act.photos) {
                // photoPath is typically 'uploads/filename.jpg'
                // Ensure we handle backslashes if stored that way
                const normalizePath = photoPath.replace(/\\/g, '/');
                const fullPath = path.resolve(__dirname, '../../', normalizePath);

                if (fs.existsSync(fullPath)) {
                    const fileName = path.basename(normalizePath);
                    archive.file(fullPath, { name: `${folderName}/${fileName}` });
                } else {
                    console.warn(`File not found: ${fullPath}`);
                }
            }
        }

        await archive.finalize();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error exporting photos' });
        }
    }
};

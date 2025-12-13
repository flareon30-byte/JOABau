const prisma = require('../prisma');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

exports.getBillingData = async (req, res) => {
    const { projectId, startDate, endDate, nvt } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    // Only apply if at least one date is present, else undefined is fine (fetches all)
    const hasDate = startDate || endDate;

    const projectFilter = projectId ? { projectId } : {};

    try {
        const results = {
            soplado: [],
            fusion: [],
            activation: [],
            protocol: []
        };

        // 1. SOPLADO
        results.soplado = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 2. FUSION
        results.fusion = await prisma.fusionWork.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                projectId: projectId || undefined,
                ...(nvt ? { nvtName: { contains: nvt, mode: 'insensitive' } } : {})
            },
            include: { project: true },
            orderBy: { createdAt: 'desc' }
        });

        // 3. ACTIVATION
        results.activation = await prisma.activationInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 4. PROTOCOL
        results.protocol = await prisma.appointment.findMany({
            where: {
                type: 'PROTOCOL',
                status: 'COMPLETADO',
                updatedAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching billing data' });
    }
};

exports.exportBillingExcel = async (req, res) => {
    const { projectId, startDate, endDate, nvt } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    const hasDate = startDate || endDate;

    const projectFilter = projectId ? { projectId } : {};

    try {
        const soplado = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const fusion = await prisma.fusionWork.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                projectId: projectId || undefined,
                ...(nvt ? { nvtName: { contains: nvt, mode: 'insensitive' } } : {})
            },
            include: { project: true }
        });

        const activation = await prisma.activationInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const protocol = await prisma.appointment.findMany({
            where: {
                type: 'PROTOCOL',
                status: 'COMPLETADO',
                updatedAt: hasDate ? dateFilter : undefined,
                address: {
                    ...projectFilter,
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const wb = XLSX.utils.book_new();

        // 1. Soplado Sheet
        const sopladoRows = soplado.map(i => ({
            Fecha: i.createdAt.toISOString().split('T')[0],
            Proyecto: i.address.project.name,
            Direccion: `${i.address.street} ${i.address.number}`,
            NVT: i.address.nvt,
            Metros: i.meters,
            TK: i.tk,
            ColorTubo: i.tubeColor,
            Estado: 'OK'
        }));
        const wsSoplado = XLSX.utils.json_to_sheet(sopladoRows);
        XLSX.utils.book_append_sheet(wb, wsSoplado, "Soplado");

        // 2. Fusion Sheet
        const fusionRows = fusion.map(i => ({
            Fecha: i.createdAt.toISOString().split('T')[0],
            Proyecto: i.project.name,
            NVT: i.nvtName,
            Fusiones: i.fusionCount,
            EnBandeja: i.isTray ? 'Sí' : 'No',
            Notas: i.description
        }));
        const wsFusion = XLSX.utils.json_to_sheet(fusionRows);
        XLSX.utils.book_append_sheet(wb, wsFusion, "Fusiones");

        // 3. Activacion Sheet
        const actRows = activation.map(i => ({
            Fecha: i.createdAt.toISOString().split('T')[0],
            Proyecto: i.address.project.name,
            Direccion: `${i.address.street} ${i.address.number}`,
            NVT: i.address.nvt,
            Cliente: i.address.clientName,
            Tipo: i.activationType,
            Puntos: i.points,
            Familiares: i.familiesCount,
            Fotos: i.photos.length
        }));
        const wsAct = XLSX.utils.json_to_sheet(actRows);
        XLSX.utils.book_append_sheet(wb, wsAct, "Activaciones");

        // 4. Protocol Sheet
        const protRows = protocol.map(i => ({
            Fecha: i.updatedAt.toISOString().split('T')[0],
            Proyecto: i.address.project.name,
            Direccion: `${i.address.street} ${i.address.number}`,
            NVT: i.address.nvt,
            Estado: i.status,
            Notas: i.reciteReason || 'Completado'
        }));
        const wsProt = XLSX.utils.json_to_sheet(protRows);
        XLSX.utils.book_append_sheet(wb, wsProt, "Protocolos");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Facturacion_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error generating Excel' });
    }
};

const prisma = require('../prisma');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

exports.exportActivationPhotos = async (req, res) => {
    const { projectId, startDate, endDate, ids } = req.query;

    console.log('Exporting documentation with filters:', { projectId, startDate, endDate, ids });

    try {
        let activations = [];
        let simpleInstallations = [];

        if (ids) {
            const idList = ids.split(',');
            // 1. Fetch from ActivationInfo
            activations = await prisma.activationInfo.findMany({
                where: { id: { in: idList } },
                include: { address: true }
            });
            // 2. Fetch from SimpleInstallation
            simpleInstallations = await prisma.simpleInstallation.findMany({
                where: { id: { in: idList } },
                include: { address: true }
            });
        } else {
            // Bulk filter (Same as before but only for ActivationInfo for now)
            const whereClause = { photos: { isEmpty: false } };
            const addressWhere = {};
            if (projectId) addressWhere.projectId = projectId;

            if (startDate && endDate) {
                whereClause.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                };
            }

            if (projectId) whereClause.address = addressWhere;

            activations = await prisma.activationInfo.findMany({
                where: whereClause,
                include: { address: true }
            });
        }

        if (activations.length === 0 && simpleInstallations.length === 0) {
            return res.status(404).send('No se encontraron registros con documentación.');
        }

        const archive = archiver('zip', { zlib: { level: 9 } });

        // Error handling for archive
        archive.on('error', (err) => {
            console.error('[ZIP ERROR]', err);
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        res.attachment(`documentacion_${new Date().getTime()}.zip`);
        archive.pipe(res);

        // Helper to add file safely
        const addFileToArchive = (filePath, archivePath) => {
            if (!filePath) return;
            filePath = filePath.split('?')[0];
            let normalized = filePath.replace(/\\/g, '/');
            if (normalized.startsWith('/')) normalized = normalized.slice(1);
            const fullPath = path.resolve(__dirname, '../../', normalized);

            if (fs.existsSync(fullPath)) {
                archive.file(fullPath, { name: archivePath });
            }
        };

        // PROCESS ACTIVATIONS
        for (const act of activations) {
            const folderName = `Doc_${act.address.street}_${act.address.number || ''}`.replace(/[\\/:*?"<>|]/g, '_');
            
            if (act.photos) {
                act.photos.forEach((p, idx) => addFileToArchive(p, `${folderName}/Fotos/Foto_${idx}.jpeg`));
            }
            if (act.pdfPath) addFileToArchive(act.pdfPath, `${folderName}/Montageprotokoll.pdf`);
        }

        // PROCESS SIMPLE INSTALLATIONS
        for (const inst of simpleInstallations) {
            const folderName = `Inst_${inst.customerLastName || 'GK'}_${inst.address.street}_${inst.address.number || ''}`.replace(/[\\/:*?"<>|]/g, '_');
            
            // Standard photos
            if (inst.photos) {
                inst.photos.forEach((p, idx) => addFileToArchive(p, `${folderName}/Fotos/Adicional_${idx}.jpeg`));
            }
            // Categorized photos
            addFileToArchive(inst.photoHuep, `${folderName}/Fotos/HUEP.jpeg`);
            addFileToArchive(inst.photoModem, `${folderName}/Fotos/Modem.jpeg`);
            addFileToArchive(inst.photoOtdr, `${folderName}/Fotos/OTDR.jpeg`);
            addFileToArchive(inst.signaturePath, `${folderName}/Fotos/Firma_Cliente.png`);

            // THE GENERATED PDF
            if (inst.pdfPath) addFileToArchive(inst.pdfPath, `${folderName}/Informe_Profesional.pdf`);
        }

        archive.append('Generación de documentación completada.', { name: 'INFO.txt' });
        await archive.finalize();

    } catch (error) {
        console.error('[EXPORT CONTROLLER ERROR]', error);
        if (!res.headersSent) res.status(500).json({ message: 'Error exporting documentation' });
    }
};

exports.getBillingData = async (req, res) => {
    const { projectId, startDate, endDate, nvt, type, clientCompanyId } = req.query;
    const isDemo = req.isDemo === true; // Filter by user demo status

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    // Only apply if at least one date is present, else undefined is fine (fetches all)
    const hasDate = startDate || endDate;

    const projectFilter = {};
    if (projectId) projectFilter.id = projectId;
    if (clientCompanyId) projectFilter.clientCompanyId = clientCompanyId;

    try {
        const results = {
            soplado: [],
            fusion: [],
            activation: [],
            protocol: [], 
            repair: [],
            simpleInstallation: [] // Added for G&K
        };

        // 1. SOPLADO
        results.soplado = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
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
                project: {
                    isDemo: isDemo,
                    ...(clientCompanyId ? { clientCompanyId } : {})
                }, // Filter by Demo
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
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                },
                ...(type ? { activationType: type } : {})
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
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } },
            orderBy: { updatedAt: 'desc' }
        });

        // 5. REPAIRS (Billable Only)
        results.repair = await prisma.appointment.findMany({
            where: {
                type: 'REPAIR_BILLABLE',
                status: 'COMPLETADO',
                updatedAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: {
                address: { include: { project: true } },
                comments: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // 6. SIMPLE INSTALLATIONS (Universal Catalog)
        results.simpleInstallation = await prisma.simpleInstallation.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { 
                address: { include: { project: true } }, 
                createdBy: true,
                items: { include: { priceItem: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 7. Calculate Totals if client is selected
        results.totals = { 
            euros: 0, 
            weekdayGross: 0,
            saturdayGross: 0,
            bp: 0, 
            ta: 0, 
            sp: 0, 
            mdu: 0, 
            gk: 0, 
            itemsSummary: {} 
        };

        if (clientCompanyId) {
            const client = await prisma.clientCompany.findUnique({ where: { id: clientCompanyId } });
            if (client) {
                const prices = client.settings || {}; // Standard settings for "Proyectos" (Legacy)
                
                // --- Part A: Activations (Using Snapshots) ---
                results.activation.forEach(act => {
                    const t = act.activationType;
                    const lineGross = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
                    
                    results.totals.euros += lineGross;
                    if (act.isSaturday) {
                        results.totals.saturdayGross += lineGross;
                    } else {
                        results.totals.weekdayGross += lineGross;
                    }

                    // Counts (For display)
                    if (t === 'BP' || t === 'BP_2_FAM') results.totals.bp++;
                    if (t === 'SDU' || t === 'BR_MULTI') results.totals.ta += (act.taCount || 1);
                    if (act.spInstalled) results.totals.sp += act.spInstalled;
                    if (act.mduInstalled) results.totals.mdu++;
                });

                // --- Part B: Soplados (Legacy lookup or Snapshot if available) ---
                const sopladoPrice = parseFloat(prices.apLPrice || 60);
                results.soplado.forEach(s => {
                    results.totals.euros += sopladoPrice;
                    if (s.isSaturday) {
                        results.totals.saturdayGross += sopladoPrice;
                    } else {
                        results.totals.weekdayGross += sopladoPrice;
                    }
                });

                // --- Part C: Dynamic Installations (SimpleInstallation) ---
                results.simpleInstallation.forEach(inst => {
                    results.totals.gk++;
                    let instGross = 0;
                    
                    if (inst.items && inst.items.length > 0) {
                        inst.items.forEach(item => {
                            const lineTotal = item.priceAtTime * item.quantity;
                            instGross += lineTotal;

                            const itemName = item.priceItem?.name || 'Varios';
                            if (!results.totals.itemsSummary[itemName]) {
                                results.totals.itemsSummary[itemName] = 0;
                            }
                            results.totals.itemsSummary[itemName] += item.quantity;
                        });
                    } else {
                        instGross = (inst.priceCharged || 0);
                    }

                    results.totals.euros += instGross;
                    // Detect if Saturday for SimpleInstallation (G&K style)
                    const isSat = inst.createdAt && new Date(inst.createdAt).getDay() === 6;
                    if (isSat) {
                        results.totals.saturdayGross += instGross;
                    } else {
                        results.totals.weekdayGross += instGross;
                    }
                });
            }
        }

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching billing data' });
    }
};

exports.exportBillingExcel = async (req, res) => {
    const { projectId, startDate, endDate, nvt, type, clientCompanyId } = req.query;
    const isDemo = req.isDemo === true; // Filter by user demo status

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    const hasDate = startDate || endDate;

    const projectFilter = {};
    if (projectId) projectFilter.id = projectId;
    if (clientCompanyId) projectFilter.clientCompanyId = clientCompanyId;

    try {
        const soplado = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const fusion = await prisma.fusionWork.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                projectId: projectId || undefined,
                project: {
                    isDemo: isDemo,
                    ...(clientCompanyId ? { clientCompanyId } : {})
                }, // Filter by Demo
                ...(nvt ? { nvtName: { contains: nvt, mode: 'insensitive' } } : {})
            },
            include: { project: true }
        });

        const activation = await prisma.activationInfo.findMany({
            where: {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                },
                ...(type ? { activationType: type } : {})
            },
            include: { address: { include: { project: true } } }
        });

        const protocol = await prisma.appointment.findMany({
            where: {
                type: 'PROTOCOL',
                status: 'COMPLETADO',
                updatedAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const repair = await prisma.appointment.findMany({
            where: {
                type: 'REPAIR_BILLABLE',
                status: 'COMPLETADO',
                updatedAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {})
                }
            },
            include: {
                address: { include: { project: true } },
                comments: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
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
            TA: (i.taInstalled || i.taCount > 0) ? (i.taCount || 1) : 0,
            SP: i.spInstalled || 0,
            MDU: i.mduInstalled ? 1 : 0,
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

        // 5. Repair Sheet
        const repairRows = repair.map(i => ({
            Fecha: i.updatedAt.toISOString().split('T')[0],
            Proyecto: i.address.project.name,
            Direccion: `${i.address.street} ${i.address.number}`,
            NVT: i.address.nvt,
            Tipo: 'Avería',
            Detalle: i.comments?.[0]?.text || 'Sin detalle'
        }));
        const wsRepair = XLSX.utils.json_to_sheet(repairRows);
        XLSX.utils.book_append_sheet(wb, wsRepair, "Averias");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Facturacion_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error generating Excel' });
    }
};

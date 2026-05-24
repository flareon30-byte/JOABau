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
            const clientName = (act.address.clientName || 'SinCliente').replace(/[\\/:*?"<>|]/g, '').trim();
            const nvtPrefix = act.address.nvt ? `${act.address.nvt}_` : '';
            const folderName = `${nvtPrefix}${act.address.street}_${act.address.number || ''}_${clientName}`.replace(/[\\/:*?"<>|]/g, '_');
            
            if (act.photos) {
                act.photos.forEach((p, idx) => addFileToArchive(p, `${folderName}/Fotos/Foto_${idx}.jpeg`));
            }
            if (act.pdfPath) addFileToArchive(act.pdfPath, `${folderName}/Montageprotokoll.pdf`);
        }

        // PROCESS SIMPLE INSTALLATIONS
        for (const inst of simpleInstallations) {
            const nvtPrefix = inst.address.nvt ? `${inst.address.nvt}_` : '';
            const folderName = `${nvtPrefix}Inst_${inst.customerLastName || 'GK'}_${inst.address.street}_${inst.address.number || ''}`.replace(/[\\/:*?"<>|]/g, '_');
            
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
    const { projectId, startDate, endDate, nvt, type, clientCompanyId, address } = req.query;
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

        // 1. SOPLADO (Filter out 0m records)
        results.soplado = await prisma.sopladoInfo.findMany({
            where: {
                meters: { gt: 0 }, // Only billable soplados
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
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
                ...(nvt ? { nvtName: { contains: nvt, mode: 'insensitive' } } : {}),
                ...(address ? { address: { contains: address, mode: 'insensitive' } } : {})
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
                    orderStatus: { notIn: ['CERRADA', 'DERIVADA'] },
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                },
                basePrice: { gt: 0 },
                ...(type ? { 
                    OR: [
                        ...(['BP', 'BP_2_FAM', 'BR_MULTI', 'SDU', 'MDU'].includes(type) ? [{ activationType: type }] : []),
                        { customActivationName: { contains: type, mode: 'insensitive' } }
                    ]
                } : {})
            },
            include: { 
                address: { include: { project: true } },
                createdBy: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // 4. PROTOCOL
        results.protocol = await prisma.appointment.findMany({
            where: {
                type: 'PROTOCOL',
                status: 'COMPLETADO',
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: { address: { include: { project: true } } },
            orderBy: { createdAt: 'desc' }
        });

        // 5. REPAIRS (Billable Only)
        results.repair = await prisma.appointment.findMany({
            where: {
                type: 'REPAIR_BILLABLE',
                status: 'COMPLETADO',
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: {
                address: { include: { project: true } },
                comments: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 6. SIMPLE INSTALLATIONS (Universal Catalog)
        results.simpleInstallation = await prisma.simpleInstallation.findMany({
            where: {
                priceCharged: { gt: 0 }, // 🟢 HIDE 0€ GK/REPAIRS
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: { 
                address: { include: { project: true } }, 
                createdBy: true,
                items: { include: { priceItem: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[BILLING] Found: ${results.activation.length} activations, ${results.simpleInstallation.length} installations after 0€ filter.`);

        // 7. Calculate Totals (Enhanced for Global or Single Client)
        results.totals = { 
            euros: 0, 
            weekdayGross: 0,
            saturdayGross: 0,
            bp: 0, 
            ta: 0, 
            sp: 0, 
            mdu: 0, 
            gk: 0, 
            itemsSummary: {
                "Dos familias": 0,
                "Horas muffa": 0,
                "MDU": 0,
                "Multi": 0,
                "SDU": 0,
                "Unifamiliar": 0
            } 
        };

        // Pre-fetch all clients with their priceItems for performance
        const allClients = await prisma.clientCompany.findMany({
            include: { priceItems: true }
        });
        const clientsMap = {};
        allClients.forEach(c => { clientsMap[c.id] = c; });

        const getClientForWork = (work) => {
            const cid = work.address?.project?.clientCompanyId || work.project?.clientCompanyId;
            return clientsMap[cid];
        };

        const calculateWorkGross = (act) => {
            return (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
        };

        // --- Part A: Activations (Snapshots - Works globally) ---
        results.activation.forEach(act => {
            const lineGross = calculateWorkGross(act);
            results.totals.euros += lineGross;
            if (act.isSaturday) results.totals.saturdayGross += lineGross;
            else results.totals.weekdayGross += lineGross;

            // Accurate Counts and Summary
            const type = act.activationType || 'Sin Tipo';
            if (type === 'BP_2_FAM') {
                results.totals.itemsSummary['Dos familias']++;
            } else if (type === 'MDU') {
                results.totals.itemsSummary['MDU']++;
            } else if (type === 'BR_MULTI') {
                results.totals.itemsSummary['Multi']++;
            } else if (type === 'SDU') {
                results.totals.itemsSummary['SDU']++;
            } else if (type === 'BP') {
                results.totals.itemsSummary['Unifamiliar']++;
            }
            
            if (type === 'BP' || type === 'BP_2_FAM') results.totals.bp++;
            
            // Count TA units strictly from technician marking
            const taCount = act.taCount > 0 ? act.taCount : (act.taInstalled ? 1 : 0);
            if (taCount > 0) {
                results.totals.ta += taCount;
            }

            // Count SP units
            if (act.spInstalled > 0) {
                results.totals.sp += act.spInstalled;
            }

            // Count MDU units strictly from technician marking
            if (act.mduInstalled) {
                results.totals.mdu++;
            }
        });

        // --- Part B: Soplados (Need client lookup for price or stored price) ---
        results.soplado.forEach(s => {
            const client = getClientForWork(s);
            const prices = client?.settings || {};
            
            // Use stored price if available (snapshot), otherwise fallback to current client price, otherwise 60
            const sopladoPrice = parseFloat(s.priceCharged || prices.apLPrice || 60);

            results.totals.euros += sopladoPrice;
            if (s.isSaturday) results.totals.saturdayGross += sopladoPrice;
            else results.totals.weekdayGross += sopladoPrice;
        });

        // --- Part C: Dynamic Installations (SimpleInstallation) ---
        results.simpleInstallation.forEach(inst => {
            let instGross = 0;
            if (inst.items && inst.items.length > 0) {
                inst.items.forEach(item => { 
                    const itemTotal = (item.priceAtTime * item.quantity);
                    instGross += itemTotal;
                });
            } else {
                instGross = (inst.priceCharged || 0);
            }

            results.totals.euros += instGross;
            // Use createdAt for stability (Date work was registered)
            const isSat = inst.createdAt && new Date(inst.createdAt).getDay() === 6;
            if (isSat) results.totals.saturdayGross += instGross;
            else results.totals.weekdayGross += instGross;
        });

        // --- Part D: Protocols (If they have a price set in client settings) ---
        results.protocol.forEach(p => {
            const client = getClientForWork(p);
            const prices = client?.settings || {};
            const protocolPrice = parseFloat(prices.protocolPrice || 0);
            
            if (protocolPrice > 0) {
                results.totals.euros += protocolPrice;
                results.totals.weekdayGross += protocolPrice; // Protocols are usually weekdays
            }
        });

        // --- Part E: Fusion (NVTs and Muffas) ---
        results.fusion.forEach(f => {
            const client = getClientForWork(f);
            
            let lineGross = 0;
            if (f.type === 'MUFFA') {
                let matchingItem = null;
                if (client && client.priceItems) {
                    matchingItem = client.priceItems.find(item => 
                        (item.name || '').toLowerCase().includes('muffa')
                    );
                }
                const hourPrice = matchingItem ? matchingItem.priceToClient : 60.00;
                lineGross = (f.hours || 0) * hourPrice;
                results.totals.itemsSummary['Horas muffa'] = parseFloat(((results.totals.itemsSummary['Horas muffa'] || 0) + (f.hours || 0)).toFixed(2));
            } else {
                let matchingItem = null;
                if (client && client.priceItems) {
                    matchingItem = client.priceItems.find(item => {
                        const name = (item.name || '').toLowerCase();
                        return name.includes('fusion') || name.includes('fusión');
                    });
                }
                const unitPrice = matchingItem ? matchingItem.priceToClient : 3.00;
                lineGross = (f.fusionCount || 0) * unitPrice;
            }

            f.totalEuros = lineGross;

            results.totals.euros += lineGross;
            const isSat = f.createdAt && new Date(f.createdAt).getDay() === 6;
            if (isSat) results.totals.saturdayGross += lineGross;
            else results.totals.weekdayGross += lineGross; 
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching billing data' });
    }
};

exports.exportBillingExcel = async (req, res) => {
    const { projectId, startDate, endDate, nvt, type, clientCompanyId, address, ids } = req.query;
    const isDemo = req.isDemo === true; // Filter by user demo status

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    const hasDate = startDate || endDate;

    const projectFilter = {};
    if (projectId) projectFilter.id = projectId;
    if (clientCompanyId) projectFilter.clientCompanyId = clientCompanyId;

    const idList = ids ? ids.split(',') : null;

    try {
        // Pre-fetch all clients with their priceItems for performance
        const allClients = await prisma.clientCompany.findMany({
            include: { priceItems: true }
        });
        const clientsMap = {};
        allClients.forEach(c => { clientsMap[c.id] = c; });

        const getClientForWork = (work) => {
            const cid = work.address?.project?.clientCompanyId || work.project?.clientCompanyId;
            return clientsMap[cid];
        };

        const soplado = await prisma.sopladoInfo.findMany({
            where: idList ? { id: { in: idList } } : {
                meters: { gt: 0 }, // Billable only
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const fusion = await prisma.fusionWork.findMany({
            where: idList ? { id: { in: idList } } : {
                createdAt: hasDate ? dateFilter : undefined,
                projectId: projectId || undefined,
                project: {
                    isDemo: isDemo,
                    ...(clientCompanyId ? { clientCompanyId } : {})
                }, // Filter by Demo
                ...(nvt ? { nvtName: { contains: nvt, mode: 'insensitive' } } : {}),
                ...(address ? { address: { contains: address, mode: 'insensitive' } } : {})
            },
            include: { project: true }
        });

        const activation = await prisma.activationInfo.findMany({
            where: idList ? { id: { in: idList } } : {
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    orderStatus: { notIn: ['CERRADA', 'DERIVADA'] },
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                },
                basePrice: { gt: 0 },
                ...(type ? { 
                    OR: [
                        ...(['BP', 'BP_2_FAM', 'BR_MULTI', 'SDU', 'MDU'].includes(type) ? [{ activationType: type }] : []),
                        { customActivationName: { contains: type, mode: 'insensitive' } }
                    ]
                } : {})
            },
            include: { address: { include: { project: true } } }
        });

        const protocol = await prisma.appointment.findMany({
            where: idList ? { id: { in: idList } } : {
                type: 'PROTOCOL',
                status: 'COMPLETADO',
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const repair = await prisma.appointment.findMany({
            where: idList ? { id: { in: idList } } : {
                type: 'REPAIR_BILLABLE',
                status: 'COMPLETADO',
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    }, // Filter by Demo
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: {
                address: { include: { project: true } },
                comments: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
        });

        const simpleInstallation = await prisma.simpleInstallation.findMany({
            where: idList ? { id: { in: idList } } : {
                priceCharged: { gt: 0 },
                createdAt: hasDate ? dateFilter : undefined,
                address: {
                    projectId: projectId || undefined,
                    project: {
                        isDemo: isDemo,
                        ...(clientCompanyId ? { clientCompanyId } : {})
                    },
                    ...(nvt ? { nvt: { contains: nvt, mode: 'insensitive' } } : {}),
                    ...(address ? {
                        OR: [
                            { street: { contains: address, mode: 'insensitive' } },
                            { city: { contains: address, mode: 'insensitive' } },
                            { number: { contains: address, mode: 'insensitive' } }
                        ]
                    } : {})
                }
            },
            include: { address: { include: { project: true } } }
        });

        const wb = XLSX.utils.book_new();

        // 1. Soplado Sheet
        const sopladoRows = soplado.map(i => ({
            Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
            Proyecto: i.address?.project?.name || 'N/A',
            Direccion: `${i.address?.street || ''} ${i.address?.number || ''}`,
            NVT: i.address?.nvt || '',
            Metros: i.meters,
            TK: i.tk || '-',
            ColorTubo: i.tubeColor || '-',
            Estado: 'OK'
        }));
        const wsSoplado = XLSX.utils.json_to_sheet(sopladoRows);
        XLSX.utils.book_append_sheet(wb, wsSoplado, "Soplado");

        // 2. Fusion Sheet
        const fusionRows = fusion.map(i => {
            const client = getClientForWork(i);
            let lineGross = 0;
            if (i.type === 'MUFFA') {
                let matchingItem = null;
                if (client && client.priceItems) {
                    matchingItem = client.priceItems.find(item => 
                        (item.name || '').toLowerCase().includes('muffa')
                    );
                }
                const hourPrice = matchingItem ? matchingItem.priceToClient : 60.00;
                lineGross = (i.hours || 0) * hourPrice;
            } else {
                let matchingItem = null;
                if (client && client.priceItems) {
                    matchingItem = client.priceItems.find(item => {
                        const name = (item.name || '').toLowerCase();
                        return name.includes('fusion') || name.includes('fusión');
                    });
                }
                const unitPrice = matchingItem ? matchingItem.priceToClient : 3.00;
                lineGross = (i.fusionCount || 0) * unitPrice;
            }

            return {
                Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
                Proyecto: i.project?.name || 'N/A',
                Tipo: i.type || 'NVT',
                NVT_Direccion: i.type === 'MUFFA' ? (i.address || '-') : (i.nvtName || '-'),
                Fusiones: i.fusionCount || 0,
                Horas: i.hours || '-',
                'Importe (€)': parseFloat(lineGross.toFixed(2)),
                EnBandeja: i.isTray ? 'Sí' : 'No',
                Notas: i.description || '-'
            };
        });
        const wsFusion = XLSX.utils.json_to_sheet(fusionRows);
        XLSX.utils.book_append_sheet(wb, wsFusion, "Fusiones");

        // 3. Activacion Sheet
        const actRows = activation.map(i => ({
            Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
            Proyecto: i.address?.project?.name || 'N/A',
            Direccion: `${i.address?.street || ''} ${i.address?.number || ''}`,
            NVT: i.address?.nvt || '',
            Cliente: i.address?.clientName || 'N/A',
            Tipo: i.activationType || 'ACTIVATION',
            TA: (i.taInstalled || i.taCount > 0) ? (i.taCount || 1) : 0,
            SP: i.spInstalled || 0,
            MDU: i.mduInstalled ? 1 : 0,
            Familiares: i.familiesCount || 0,
            Fotos: i.photos?.length || 0
        }));
        const wsAct = XLSX.utils.json_to_sheet(actRows);
        XLSX.utils.book_append_sheet(wb, wsAct, "Activaciones");

        // 4. Protocol Sheet
        const protRows = protocol.map(i => ({
            Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
            Proyecto: i.address?.project?.name || 'N/A',
            Direccion: `${i.address?.street || ''} ${i.address?.number || ''}`,
            NVT: i.address?.nvt || '',
            Estado: i.status || 'COMPLETADO',
            Notas: i.reciteReason || 'Completado'
        }));
        const wsProt = XLSX.utils.json_to_sheet(protRows);
        XLSX.utils.book_append_sheet(wb, wsProt, "Protocolos");

        // 5. Repair Sheet
        const repairRows = repair.map(i => ({
            Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
            Proyecto: i.address?.project?.name || 'N/A',
            Direccion: `${i.address?.street || ''} ${i.address?.number || ''}`,
            NVT: i.address?.nvt || '',
            Tipo: 'Avería',
            Detalle: i.comments?.[0]?.text || 'Sin detalle'
        }));
        const wsRepair = XLSX.utils.json_to_sheet(repairRows);
        XLSX.utils.book_append_sheet(wb, wsRepair, "Averias");

        // 6. G&K Installations Sheet
        const gkRows = simpleInstallation.map(i => ({
            Fecha: (i.createdAt || new Date()).toISOString().split('T')[0],
            Proyecto: i.address?.project?.name || 'N/A',
            Direccion: `${i.address?.street || ''} ${i.address?.number || ''}`,
            Detalles: i.items?.map(item => `${item.quantity}x ${item.priceItem?.name || 'Item'}`).join(', ') || 'Legacy',
            Total: (i.priceCharged || 0) + '€',
            Notas: i.comments || '-'
        }));
        const wsGk = XLSX.utils.json_to_sheet(gkRows);
        XLSX.utils.book_append_sheet(wb, wsGk, "GK_Instalaciones");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Facturacion_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error generating Excel' });
    }
};

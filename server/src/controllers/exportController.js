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
                include: { address: { include: { appointment: true } } }
            });
            // 2. Fetch from SimpleInstallation
            simpleInstallations = await prisma.simpleInstallation.findMany({
                where: { id: { in: idList } },
                include: { address: { include: { appointment: true } } }
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
                include: { address: { include: { appointment: true } } }
            });
        }

        // --- CLIENT SIDE FILTERING FOR 'RECITAR' ---
        activations = activations.filter(a => !a.address?.appointment || a.address.appointment.status !== 'RECITAR');
        simpleInstallations = simpleInstallations.filter(s => !s.address?.appointment || s.address.appointment.status !== 'RECITAR');

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

exports.debugBilling = async (req, res) => {
    try {
        const address = req.query.address || 'Ludwig-Jahn-Str. 5';
        const addrs = await prisma.address.findMany({
            where: { street: { contains: address, mode: 'insensitive' } },
            include: { appointment: true, activationInfo: true, simpleInstallation: true }
        });
        res.json(addrs);
    } catch (e) {
        res.status(500).json(e);
    }
};

exports.getBillingData = async (req, res) => {
    const { projectId, subcontractorId, reviewStatus, startDate, endDate } = req.query;

    try {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        const hasDate = startDate || endDate;

        const reportWhere = {};
        if (subcontractorId) {
            reportWhere.subcontractorId = subcontractorId;
        }
        if (hasDate) {
            reportWhere.date = dateFilter;
        }

        // Fetch all civil daily reports matching filters, including their subcontractor, workLogs and ductLogs
        const reports = await prisma.civilDailyReport.findMany({
            where: reportWhere,
            include: {
                subcontractor: {
                    include: {
                        projects: true
                    }
                },
                workLogs: {
                    include: {
                        address: {
                            include: {
                                project: true
                            }
                        }
                    }
                },
                ductLogs: true
            },
            orderBy: { date: 'desc' }
        });

        let workLogs = [];
        let ductLogs = [];

        reports.forEach(report => {
            // For workLogs: filter by projectId and reviewStatus
            report.workLogs.forEach(wl => {
                if (projectId && wl.address?.projectId !== projectId) {
                    return;
                }
                if (reviewStatus && reviewStatus !== 'TODOS') {
                    if (wl.reviewStatus !== reviewStatus) {
                        return;
                    }
                }
                
                workLogs.push({
                    ...wl,
                    report: {
                        id: report.id,
                        date: report.date,
                        subcontractor: {
                            id: report.subcontractor.id,
                            name: report.subcontractor.name
                        },
                        peoplePresent: report.peoplePresent
                    }
                });
            });

            // For ductLogs: filter by reviewStatus and subcontractor projects
            report.ductLogs.forEach(dl => {
                if (projectId) {
                    const hasProject = report.subcontractor.projects.some(p => p.id === projectId);
                    if (!hasProject) {
                        return;
                    }
                }
                if (reviewStatus && reviewStatus !== 'TODOS') {
                    if (dl.reviewStatus !== reviewStatus) {
                        return;
                    }
                }

                const associatedProject = projectId 
                    ? report.subcontractor.projects.find(p => p.id === projectId)
                    : report.subcontractor.projects[0] || null;

                ductLogs.push({
                    ...dl,
                    project: associatedProject,
                    report: {
                        id: report.id,
                        date: report.date,
                        subcontractor: {
                            id: report.subcontractor.id,
                            name: report.subcontractor.name
                        },
                        peoplePresent: report.peoplePresent
                    }
                });
            });
        });

        // Calculate Totals and Financial Summary by Subcontractor
        const subcontractorSummary = {};
        let totalEurosPending = 0;
        let totalEurosApproved = 0;

        workLogs.forEach(wl => {
            const project = wl.address?.project;
            const pricePerAcometida = project?.pricePerAcometida || 0.0;
            const subId = wl.report.subcontractor.id;
            const subName = wl.report.subcontractor.name;

            if (!subcontractorSummary[subId]) {
                subcontractorSummary[subId] = {
                    id: subId,
                    name: subName,
                    pendingAmount: 0,
                    approvedAmount: 0,
                    workLogsCount: 0,
                    ductLogsCount: 0
                };
            }

            subcontractorSummary[subId].workLogsCount++;

            if (wl.reviewStatus === 'REVISADO') {
                const finalPrice = wl.pricePaid > 0 ? wl.pricePaid : pricePerAcometida;
                subcontractorSummary[subId].approvedAmount += finalPrice;
                totalEurosApproved += finalPrice;
            } else {
                subcontractorSummary[subId].pendingAmount += pricePerAcometida;
                totalEurosPending += pricePerAcometida;
            }
        });

        ductLogs.forEach(dl => {
            const project = dl.project;
            const pricePerMeter = project?.pricePerMeter || 0.0;
            const distance = dl.distance || 0.0;
            const estimatedPrice = distance * pricePerMeter;
            const subId = dl.report.subcontractor.id;
            const subName = dl.report.subcontractor.name;

            if (!subcontractorSummary[subId]) {
                subcontractorSummary[subId] = {
                    id: subId,
                    name: subName,
                    pendingAmount: 0,
                    approvedAmount: 0,
                    workLogsCount: 0,
                    ductLogsCount: 0
                };
            }

            subcontractorSummary[subId].ductLogsCount++;

            if (dl.reviewStatus === 'REVISADO') {
                const finalPrice = dl.pricePaid > 0 ? dl.pricePaid : estimatedPrice;
                subcontractorSummary[subId].approvedAmount += finalPrice;
                totalEurosApproved += finalPrice;
            } else {
                subcontractorSummary[subId].pendingAmount += estimatedPrice;
                totalEurosPending += estimatedPrice;
            }
        });

        // Round summary numbers
        Object.keys(subcontractorSummary).forEach(id => {
            subcontractorSummary[id].pendingAmount = parseFloat(subcontractorSummary[id].pendingAmount.toFixed(2));
            subcontractorSummary[id].approvedAmount = parseFloat(subcontractorSummary[id].approvedAmount.toFixed(2));
        });

        res.json({
            workLogs,
            ductLogs,
            totals: {
                totalEurosPending: parseFloat(totalEurosPending.toFixed(2)),
                totalEurosApproved: parseFloat(totalEurosApproved.toFixed(2)),
                subcontractorSummary: Object.values(subcontractorSummary)
            }
        });

    } catch (error) {
        console.error('Error in getBillingData:', error);
        res.status(500).json({ message: 'Error interno al obtener los datos de producción.' });
    }
};

exports.exportBillingExcel = async (req, res) => {
    const { projectId, subcontractorId, reviewStatus, startDate, endDate } = req.query;

    try {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        const hasDate = startDate || endDate;

        const reportWhere = {};
        if (subcontractorId) {
            reportWhere.subcontractorId = subcontractorId;
        }
        if (hasDate) {
            reportWhere.date = dateFilter;
        }

        const reports = await prisma.civilDailyReport.findMany({
            where: reportWhere,
            include: {
                subcontractor: {
                    include: {
                        projects: true
                    }
                },
                workLogs: {
                    include: {
                        address: {
                            include: {
                                project: true
                            }
                        }
                    }
                },
                ductLogs: true
            },
            orderBy: { date: 'desc' }
        });

        let workLogs = [];
        let ductLogs = [];

        reports.forEach(report => {
            report.workLogs.forEach(wl => {
                if (projectId && wl.address?.projectId !== projectId) return;
                if (reviewStatus && reviewStatus !== 'TODOS' && wl.reviewStatus !== reviewStatus) return;
                workLogs.push({ ...wl, report });
            });

            report.ductLogs.forEach(dl => {
                if (projectId) {
                    const hasProject = report.subcontractor.projects.some(p => p.id === projectId);
                    if (!hasProject) return;
                }
                if (reviewStatus && reviewStatus !== 'TODOS' && dl.reviewStatus !== reviewStatus) return;

                const associatedProject = projectId 
                    ? report.subcontractor.projects.find(p => p.id === projectId)
                    : report.subcontractor.projects[0] || null;

                ductLogs.push({ ...dl, project: associatedProject, report });
            });
        });

        const wb = XLSX.utils.book_new();

        // 1. Sheet Acometidas
        const workRows = workLogs.map(wl => {
            const project = wl.address?.project;
            const pricePerAcometida = project?.pricePerAcometida || 0.0;
            const price = wl.reviewStatus === 'REVISADO' 
                ? (wl.pricePaid > 0 ? wl.pricePaid : pricePerAcometida)
                : pricePerAcometida;

            return {
                'Fecha Parte': wl.report.date.toISOString().split('T')[0],
                'Subcontrata': wl.report.subcontractor.name,
                'Proyecto': project?.name || 'N/A',
                'Dirección': `${wl.address?.street || ''} ${wl.address?.number || ''}, ${wl.address?.city || ''}`,
                'Color Conexión': wl.connectionColor || 'No indicado',
                'Estado Físico': wl.status,
                'Estado Revisión': wl.reviewStatus === 'REVISADO' ? 'Revisado' : 'Pendiente de Revisión',
                'Comentarios': wl.comments || '',
                'Precio Asignado (€)': price,
                'Facturable': wl.reviewStatus === 'REVISADO' ? 'Sí' : 'No'
            };
        });
        const wsWork = XLSX.utils.json_to_sheet(workRows);
        XLSX.utils.book_append_sheet(wb, wsWork, "Acometidas");

        // 2. Sheet Ductos de Calle
        const ductRows = ductLogs.map(dl => {
            const project = dl.project;
            const pricePerMeter = project?.pricePerMeter || 0.0;
            const distance = dl.distance || 0.0;
            const estimatedPrice = distance * pricePerMeter;
            const price = dl.reviewStatus === 'REVISADO'
                ? (dl.pricePaid > 0 ? dl.pricePaid : estimatedPrice)
                : estimatedPrice;

            return {
                'Fecha Parte': dl.report.date.toISOString().split('T')[0],
                'Subcontrata': dl.report.subcontractor.name,
                'Proyecto': project?.name || 'N/A',
                'Distancia (m)': distance,
                'Estado Revisión': dl.reviewStatus === 'REVISADO' ? 'Revisado' : 'Pendiente de Revisión',
                'Comentarios': dl.comments || '',
                'Precio Asignado (€)': price,
                'Facturable': dl.reviewStatus === 'REVISADO' ? 'Sí' : 'No'
            };
        });
        const wsDuct = XLSX.utils.json_to_sheet(ductRows);
        XLSX.utils.book_append_sheet(wb, wsDuct, "Ductos de Calle");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Control_Produccion_${new Date().toISOString().slice(0, 10)}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        console.error('Error in exportBillingExcel:', error);
        res.status(500).json({ message: 'Error al exportar el excel de producción.' });
    }
};

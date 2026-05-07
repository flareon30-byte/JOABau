const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { processImages } = require('../utils/imageProcessor');
const pdfService = require('../services/pdfService');

exports.createInstallation = async (req, res) => {
    try {
        const { 
            projectId, contactName, comments, addressInfo, itemsJSON,
            customerFirstName, customerLastName, olt, pon, splitterPort, gponSerialNumber,
            isReadyForOperation, gpsAlt, gpsLat, gpsLng
        } = req.body;
        
        const files = req.files || {};
        const photos = files.photos || [];
        const photoHuepFile = files.photoHuep ? files.photoHuep[0] : null;
        const photoModemFile = files.photoModem ? files.photoModem[0] : null;
        const photoOtdrFile = files.photoOtdr ? files.photoOtdr[0] : null;
        const signatureFile = files.signature ? files.signature[0] : null;

        const userId = req.userId;

        // Compression for all images
        const allFilesToProcess = [...photos];
        if (photoHuepFile) allFilesToProcess.push(photoHuepFile);
        if (photoModemFile) allFilesToProcess.push(photoModemFile);
        if (photoOtdrFile) allFilesToProcess.push(photoOtdrFile);
        if (signatureFile) allFilesToProcess.push(signatureFile);

        if (allFilesToProcess.length > 0) {
            const techUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
            const techName = techUser?.username || 'Técnico JOA';
            await processImages(allFilesToProcess, techName);
        }

        // Parse address info
        if (!addressInfo) {
            return res.status(400).json({ message: 'Información de dirección faltante' });
        }
        
        let parsedAddress = JSON.parse(addressInfo);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                activeClientCompany: true,
                team: { include: { activeClientCompany: true } }
            }
        });
        
        const activeClient = user.activeClientCompany || (user.team ? user.team.activeClientCompany : null);
        const activeClientId = activeClient ? activeClient.id : null;
        const clientName = activeClient ? activeClient.name : 'General';
        
        let targetProjectId = projectId;
        if (!targetProjectId) {
            let dummyProject = await prisma.project.findFirst({ where: { name: `Proyectos Varios - ${clientName}` } });
            if (!dummyProject) {
                dummyProject = await prisma.project.create({
                    data: { name: `Proyectos Varios - ${clientName}`, clientCompanyId: activeClientId }
                });
            }
            targetProjectId = dummyProject.id;
        }

        const address = await prisma.address.create({
            data: {
                projectId: targetProjectId,
                street: parsedAddress.street,
                number: parsedAddress.number,
                city: parsedAddress.city,
            }
        });

        const photoUrls = photos.map(file => `/uploads/${file.filename}`);
        const parsedItems = itemsJSON ? JSON.parse(itemsJSON) : [];
        let totalBillable = 0;
        
        const priceItemIds = parsedItems.map(i => i.priceItemId);
        const actualPriceItems = await prisma.clientPriceItem.findMany({ where: { id: { in: priceItemIds } } });

        const itemsToCreate = parsedItems.map(sentItem => {
            const actual = actualPriceItems.find(ap => ap.id === sentItem.priceItemId);
            if (!actual) return null;
            const qty = parseInt(sentItem.quantity || 1);
            totalBillable += (actual.priceToClient * qty);
            return {
                priceItemId: actual.id,
                quantity: qty,
                priceAtTime: actual.priceToClient,
                bonusAtTime: actual.bonusToTeam
            };
        }).filter(Boolean);

        // Create the SimpleInstallation record
        const installation = await prisma.simpleInstallation.create({
            data: {
                addressId: address.id,
                contactName,
                comments,
                photos: photoUrls,
                createdById: userId,
                priceCharged: totalBillable,
                
                // MUENET / Generic Fields
                customerFirstName,
                customerLastName,
                olt,
                pon,
                splitterPort,
                gponSerialNumber,
                isReadyForOperation: isReadyForOperation === 'true' || isReadyForOperation === true,
                gpsLat: gpsLat ? parseFloat(gpsLat) : null,
                gpsLng: gpsLng ? parseFloat(gpsLng) : null,
                gpsAlt: gpsAlt ? parseFloat(gpsAlt) : (parsedAddress.alt ? parseFloat(parsedAddress.alt) : null),
                
                photoHuep: photoHuepFile ? `/uploads/${photoHuepFile.filename}` : null,
                photoModem: photoModemFile ? `/uploads/${photoModemFile.filename}` : null,
                photoOtdr: photoOtdrFile ? `/uploads/${photoOtdrFile.filename}` : null,
                signaturePath: signatureFile ? `/uploads/${signatureFile.filename}` : null,

                items: { create: itemsToCreate }
            },
            include: { 
                items: { include: { priceItem: true } },
                address: true,
                createdBy: true
            }
        });

        // --- AUTOMATIC PDF GENERATION ---
        let finalPdfPath = null;
        try {
            finalPdfPath = await pdfService.generateInstallationReport(installation);
            // Non-blocking update (or block if you prefer completeness)
            await prisma.simpleInstallation.update({
                where: { id: installation.id },
                data: { pdfPath: finalPdfPath }
            });
        } catch (pdfError) {
            console.error('[CRITICAL] PDF Report Generation Failed:', pdfError);
        }

        res.status(201).json({ 
            message: 'Installation recorded successfully', 
            installation: { ...installation, pdfPath: finalPdfPath } 
        });
    } catch (error) {
        console.error('Error creating simple installation:', error);
        res.status(500).json({ 
            message: 'Error processing installation', 
            details: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined 
        });
    }
};

exports.getInstallations = async (req, res) => {
    try {
        const installations = await prisma.simpleInstallation.findMany({
            include: { 
                address: { include: { project: true } }, 
                createdBy: true,
                items: { include: { priceItem: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(installations);
    } catch (error) {
        console.error('Error fetching installations:', error);
        res.status(500).json({ message: 'Error fetching installations' });
    }
};

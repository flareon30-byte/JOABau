const prisma = require('../prisma');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { processImages } = require('../utils/imageProcessor');
const { sendPushToRole } = require('../utils/notificationUtils');

// Points System Configuration
const POINTS_MAP = {
    'BP': 10,
    'BP_2_FAM': 15,
    'BR_MULTI': 20,
    'SDU': 25,
    'MDU': 30
};

// Get appointments assigned to the logged-in user's team
exports.getMyAppointments = async (req, res) => {
    const userId = req.userId;

    try {
        // Get user's team
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { teamId: true }
        });

        const teamId = user.teamId || 'no-team';

        const appointments = await prisma.appointment.findMany({
            where: {
                OR: [
                    { assignedTeamId: teamId },
                    { 
                        address: { 
                            activationInfo: { 
                                performerIds: { has: userId } 
                            } 
                        } 
                    },
                    {
                        address: {
                            sopladoInfo: {
                                performerIds: { has: userId }
                            }
                        }
                    }
                ]
            },
            include: {
                address: {
                    include: {
                        project: true,
                        activationInfo: true,
                        sopladoInfo: true
                    }
                }
            },
            orderBy: { assignedDate: 'desc' },
            take: 100 // Incremented slightly to ensure they see past few days
        });

        res.json(appointments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

exports.getActivationByAddress = async (req, res) => {
    const { addressId } = req.params;
    try {
        const appointment = await prisma.appointment.findUnique({
            where: { addressId },
            include: {
                address: {
                    include: {
                        project: true,
                        activationInfo: {
                            include: { createdBy: true }
                        }
                    }
                }
            }
        });

        // If no appointment record exists, we synthesize one from address/activationInfo
        if (!appointment) {
            const address = await prisma.address.findUnique({
                where: { id: addressId },
                include: {
                    project: true,
                    activationInfo: { include: { createdBy: true } }
                }
            });
            if (!address) return res.status(404).json({ message: 'Dirección no encontrada' });
            
            return res.json({
                id: 'synth-' + address.id,
                addressId: address.id,
                status: address.activationInfo ? 'COMPLETADO' : 'PENDIENTE',
                address: address,
                clientName: address.clientName,
                assignedDate: address.activationInfo?.createdAt || address.createdAt
            });
        }

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activation details' });
    }
};

// Submit Activation Report
exports.submitActivation = async (req, res) => {
    const { addressId } = req.params;
    let {
        activationType = 'BP',
        familiesCount = 1,
        apPorts,
        hasMoreClients = false,
        spInstalled,
        taInstalled,
        taCount,
        homeIds,
        description,
        isMDU,
        klsId,
        pdfPath,
        mduInstalled,
        isRepair,
        homeId
    } = req.body;

    // Con upload.any(), req.files es un array plano en lugar de un objeto con claves
    const photos = Array.isArray(req.files) ? req.files.filter(f => f.fieldname === 'photos') : [];
    const signedPdfFile = Array.isArray(req.files) ? req.files.find(f => f.fieldname === 'signedPdf') : null;

    if (signedPdfFile) {
        pdfPath = signedPdfFile.path.replace(/\\/g, '/');
    }

    // 🟢 COMPRESIÓN DE IMÁGENES (Dentro de try-catch para evitar Error 500 si falla el procesamiento)
    try {
        if (photos.length > 0) {
            // Obtener nombre del técnico para la marca de agua
            const techUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true } });
            const techName = techUser?.username || 'Técnico JOA';
            await processImages(photos, techName);
        }
    } catch (procErr) {
        console.error("Image processing error, continuing:", procErr);
    }

    try {
        const photoPaths = photos.map(f => f.path.replace(/\\/g, '/'));

        // Parsing
        let homeIdsArray = [];
        try {
            homeIdsArray = JSON.parse(homeIds || '[]');
        } catch (e) {
            homeIdsArray = [homeIds];
        }

        // Parse existingPhotos safely
        let keptPhotos = [];
        if (req.body.existingPhotos) {
            const rawVal = Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos[0] : req.body.existingPhotos;
            try {
                keptPhotos = JSON.parse(rawVal);
            } catch (e) {
                console.error("Error parsing existingPhotos JSON:", rawVal);
                keptPhotos = [];
            }
        }

        const allPhotos = [...keptPhotos, ...photoPaths];

        // Fallback for singular homeId
        if (homeIdsArray.length === 0 && homeId) {
            homeIdsArray = [homeId];
        }

        const famCount = parseInt(familiesCount) || 1;
        const spCount = parseInt(spInstalled) || 0;
        const taCountInt = parseInt(taCount) || 0;
        const apPortsInt = parseInt(apPorts || 0) || 1;
        const isMduBool = mduInstalled === 'true' || mduInstalled === true;
        const isRepairBool = isRepair === 'true' || isRepair === true;
        
        // 🔴 UNIFICACIÓN SDU/TA: Si el técnico marca SDU, por definición hay una TA instalada.
        let taInstalledBool = taInstalled === 'true' || taInstalled === true;
        let finalTaCount = taInstalledBool ? (taCountInt > 0 ? taCountInt : 1) : 0;
        
        // El precio de TA y MDU ya no se fuerza por tipo de activación, solo por selector manual.

        // 1. Fetch Address and Project to know the client rates
        const address = await prisma.address.findUnique({
            where: { id: addressId },
            include: { 
                project: { include: { clientCompany: { include: { priceItems: true } } } },
                activationInfo: true,
                appointment: { include: { assignedTeam: { include: { members: true } } } }
            }
        });

        if (!address) {
            return res.status(404).json({ message: 'Dirección no encontrada' });
        }

        const activeClient = address.project?.clientCompany;
        const priceItems = activeClient?.priceItems || [];

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { team: { include: { members: true } } }
        });

        // Fetch Global System Settings (Fallback)
        const settings = await prisma.systemSettings.findFirst();
        let fin = {};
        try {
            if (settings && settings.financials) {
                // financials can be an object or a string depending on DB driver/version
                const rawFin = typeof settings.financials === 'string' ? JSON.parse(settings.financials) : settings.financials;
                fin = rawFin.installers || {};
            }
        } catch (e) {
            console.error("[SubmitActivation] Error parsing financials:", e);
            fin = {};
        }

        const isSaturday = req.body.isSaturday === 'true' || req.body.isSaturday === true || (new Date().getDay() === 6);

        // Financials (Snapshot)
        let basePrice = parseFloat(fin.pricePerUnit || 60);
        let saturdayPay = 0;

        // Try to find specific prices in ClientPriceItems
        // Try to find exact specific prices in ClientPriceItems BY NAME first, then fallback to legacy mapping
        let matchingItem = priceItems.find(item => item.name === activationType);

        if (!matchingItem) {
            matchingItem = priceItems.find(item => {
                if (activationType === 'BP' || activationType === 'BP_2_FAM') return item.name.includes('Caja') || item.name.includes('BP');
                if (activationType === 'SDU') return item.name.includes('SDU') || item.name.includes('TA');
                if (activationType === 'MDU') return item.name.includes('MDU');
                if (activationType === 'BR_MULTI') return item.name.includes('BR') || item.name.includes('Multi');
                return false;
            });
        }

        if (matchingItem) {
            basePrice = matchingItem.priceToClient;
            if (isSaturday) {
                saturdayPay += (matchingItem.saturdayPay || 0); // Incrementar en vez de asignar
            }
        }

        const pricePerSP = parseFloat(fin.pricePerSP || 75);
        const totalSpPrice = spCount * pricePerSP;

        let taPriceTotal = 0;
        let sduDynamicPrice = parseFloat(fin.pricePerTA || 25);
        const sduItem = priceItems.find(item => item.name.trim().toUpperCase() === 'SDU');
        if (sduItem && sduItem.priceToClient !== undefined) {
            sduDynamicPrice = sduItem.priceToClient;
        }
        const finalTaCountCalculated = taInstalledBool ? (taCountInt > 0 ? taCountInt : 1) : 0;
        if (finalTaCountCalculated > 0) {
            taPriceTotal = finalTaCountCalculated * sduDynamicPrice;
            if (isSaturday && sduItem && sduItem.saturdayPay) {
                saturdayPay += ((sduItem.saturdayPay || 0) * finalTaCountCalculated);
            }
        }

        let mduPriceTotal = 0;
        let mduDynamicPrice = parseFloat(fin.pricePerMDU || 50);
        const mduItem = priceItems.find(item => item.name.trim().toUpperCase() === 'MDU');
        if (mduItem && mduItem.priceToClient !== undefined) {
            mduDynamicPrice = mduItem.priceToClient;
        }
        if (isMduBool) {
            mduPriceTotal = mduDynamicPrice;
            if (isSaturday && mduItem && mduItem.saturdayPay) {
                saturdayPay += (mduItem.saturdayPay || 0);
            }
        }

        let repairPriceTotal = 0;
        const priceRepair = parseFloat(settings?.repairPrice || 45);
        if (isRepairBool) repairPriceTotal = priceRepair;

        // Legacy Points
        const pointsConfig = {
            'BP': settings?.bpPoints || 10,
            'BP_2_FAM': settings?.bp2FamPoints || 15,
            'BR_MULTI': settings?.brMultiPoints || 20,
            'SDU': settings?.sduPoints || 25,
            'MDU': settings?.mduPoints || 30,
            'SP': settings?.spPoints || 5,
            'TA': settings?.sduPoints || 25
        };

        let points = 0;
        if (pointsConfig[activationType]) points += pointsConfig[activationType];

        // Add SP points (usually extras)
        if (spCount > 0) points += (spCount * pointsConfig['SP']);

        // Only add TA points as EXTRA if the base type is NOT SDU
        if (activationType !== 'SDU' && finalTaCount > 0) {
            let taPointValue = pointsConfig['TA'] || pointsConfig['SDU'];
            if (['BP_2_FAM', 'BR_MULTI'].includes(activationType)) {
                taPointValue = pointsConfig['MDU'];
            }
            points += (finalTaCount * taPointValue);
        }

        // Only add MDU points as EXTRA if the base type is NOT MDU
        if (activationType !== 'MDU' && isMduBool) {
            points += pointsConfig['MDU'];
        }

        const result = await prisma.$transaction(async (tx) => {
            if (klsId) {
                await tx.address.update({
                    where: { id: addressId },
                    data: { klsId }
                });
            }

            const validEnumValues = ['BP', 'BP_2_FAM', 'BR_MULTI', 'SDU', 'MDU'];
            const finalActivationType = validEnumValues.includes(activationType) ? activationType : 'BP';
            const customActivationName = !validEnumValues.includes(activationType) ? activationType : null;

            const data = {
                activationType: finalActivationType,
                customActivationName: customActivationName,
                familiesCount: famCount,
                apPorts: apPortsInt,
                hasMoreClients: hasMoreClients === 'true' || hasMoreClients === true,
                spInstalled: spCount,
                taInstalled: taInstalledBool,
                taCount: finalTaCount,
                mduInstalled: isMduBool,
                isRepair: isRepairBool,
                homeIds: homeIdsArray,
                description,
                points,
                isSaturday,
                saturdayPay,
                basePrice,
                spPrice: totalSpPrice,
                taPrice: taPriceTotal,
                mduPrice: mduPriceTotal,
                repairPrice: repairPriceTotal,
                pdfPath: pdfPath ? pdfPath.split('?')[0] : null, // Clean query string before saving to DB
                photos: allPhotos,
                // --- ATTRIBUTION LOGIC ---
                // If editing as admin, preserve existing performers if available.
                // If it's a new activation closed by an admin, try to attribute it to the assigned team members.
                performerIds: address.activationInfo?.performerIds?.length > 0 
                    ? address.activationInfo.performerIds 
                    : (address.appointment?.assignedTeam?.members.map(m => m.id) || user?.team?.members.map(m => m.id) || [req.userId]),
                createdById: address.activationInfo?.createdById || (req.userRole === 'ADMIN' || req.userRole === 'SUPER_ADMIN' ? (address.appointment?.assignedTeam?.members[0]?.id || req.userId) : req.userId),
                isDraft: false
            };



            // 🟢 FORCE NEW DATE ONLY IF IT WAS A DRAFT (This solves the "why does it have yesterday's date" problem)
            if (address.activationInfo && address.activationInfo.isDraft) {
                data.createdAt = new Date();
            }

            const activation = await tx.activationInfo.upsert({
                where: { addressId },
                update: data,
                create: {
                    addressId,
                    ...data,
                    createdAt: new Date() // Ensure fresh date for new ones
                }
            });

            // Use updateMany to safely update if exists, or do nothing if not, preventing 500 errors
            await tx.appointment.updateMany({
                where: { addressId },
                data: { status: 'COMPLETADO' }
            });

            await tx.address.update({
                where: { id: addressId },
                data: { orderStatus: 'Installiert' }
            });

            return activation;
        });

        // --- NEW NOTIFICATION FOR SUPER ADMIN (WRAPPED IN TRY-CATCH TO PREVENT 500s) ---
        try {
            const [notifAddress, notifUser] = await Promise.all([
                prisma.address.findUnique({ where: { id: addressId }, include: { project: true } }),
                prisma.user.findUnique({ where: { id: req.userId }, select: { username: true } })
            ]);

            if (notifAddress && notifUser) {
                const projectName = notifAddress.project?.name || 'Proyecto Desconocido';
                const notificationMsg = `⚡ ¡Activación Exitosa! ${notifUser.username} ha terminado en ${notifAddress.street} ${notifAddress.number} (${projectName}). Tipo: ${activationType}`;
                
                await prisma.notification.create({
                    data: {
                        type: 'ACTIVATION_COMPLETED',
                        message: notificationMsg,
                        addressId: addressId,
                        createdById: req.userId,
                        targetRole: 'SUPER_ADMIN'
                    }
                });

                sendPushToRole('SUPER_ADMIN', {
                    title: '⚡ ¡Suministro Finalizado!',
                    body: notificationMsg,
                    data: { addressId: addressId }
                }).catch(e => console.error('Push error:', e.message));
            }
        } catch (notifErr) {
            console.error('Non-critical notification error:', notifErr.message);
        }

        res.json(result);
    } catch (error) {
        console.error('SubmitActivation Error:', error);
        res.status(500).json({
            message: 'Error al guardar la activación en el servidor',
            error: error.message,
            code: error.code
        });
    }
};
// Get All Activations (Admin)
exports.getAllActivations = async (req, res) => {
    const { startDate, endDate, teamId, projectId } = req.query;

    try {
        const where = {};

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (teamId) {
            where.OR = [
                {
                    address: {
                        appointment: {
                            assignedTeamId: teamId
                        }
                    }
                },
                {
                    performerIds: { has: teamId } // This is a fallback if you pass a userId instead of teamId, or we can handle it specifically
                }
            ];
        }

        if (projectId) {
            where.address = {
                ...where.address,
                projectId: projectId,
                orderStatus: { notIn: ['CERRADA', 'DERIVADA'] }
            };
        } else {
            where.address = {
                orderStatus: { notIn: ['CERRADA', 'DERIVADA'] }
            };
        }

        const activations = await prisma.activationInfo.findMany({
            where,
            include: {
                address: {
                    include: {
                        project: true,
                        appointment: {
                            include: {
                                assignedTeam: {
                                    include: { members: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(activations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activations' });
    }
};

exports.generatePdf = async (req, res) => {
    console.log('--- STARTING PDF GENERATION ---');
    try {
        const { addressId, clientName, street, number, city, klsId, clientSignature, techSignature } = req.body;
        console.log('Request body:', { addressId, clientName, street, number, city, klsId, hasClientSig: !!clientSignature, hasTechSig: !!techSignature });

        // Fetch User details (Phone, Username) safely from DB
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { username: true, phone: true }
        });
        console.log('User found:', user);

        const activeUsername = user ? user.username : (req.body.username || '');
        const activePhone = user ? user.phone : (req.body.userPhone || '');

        // Load PDF
        const pdfPath = path.join(__dirname, '../../templates/dokumentation von GlasfaserPlus.pdf');
        console.log('Looking for PDF at:', pdfPath);

        if (!fs.existsSync(pdfPath)) {
            console.error('CRITICAL: PDF Template NOT FOUND at', pdfPath);
            // Attempt to list directory to debug
            const dir = path.dirname(pdfPath);
            console.log('Contents of directory ' + dir + ':', fs.readdirSync(dir));
            return res.status(404).json({ message: 'Template PDF not found on server' });
        }

        console.log('PDF Template found. Reading file...');
        const existingPdfBytes = fs.readFileSync(pdfPath);

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();

        // Helper to safe fill
        const fill = (name, val, fontSize) => {
            try {
                const field = form.getTextField(name);
                field.setText(val ? String(val) : '');
                if (fontSize) {
                    field.setFontSize(fontSize);
                }
            } catch (e) {
                // Field might be checkbox or not exist, ignore
            }
        };

        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const today = new Date().toLocaleDateString('de-DE');
        const cityDate = `${city || ''}, ${today}`;

        // Map fields based on inspection
        fill('Text7', clientName);
        fill('Text9', `${street} ${number || ''}`);
        fill('Text10', city);
        fill('Text11', activeUsername);
        fill('Text12', activePhone); // Phone number
        fill('Text14', klsId);

        fill('Text42', cityDate, 7); // Monteur Middle - Smaller font
        fill('Text43', cityDate, 7); // Eigentümer Middle - Smaller font

        fill('Text1', ''); // Clear Abweichung

        // --- EMBED SIGNATURES (PIN SYSTEM) ---
        // Strategy: Use SIG_ fields as "Pins" for coordinates (X,Y), but force a fixed size (140x50)

        const placeSignaturePin = async (sigBase64, fieldName) => {
            if (!sigBase64) {
                console.warn(`[PDF GEN] No signature data for ${fieldName}`);
                return;
            }

            try {
                // 1. Find the "Pin" field
                let rect = { x: 0, y: 0 };
                let found = false;

                try {
                    const sigField = form.getTextField(fieldName);
                    const widgets = sigField.getWidgets();
                    if (widgets && widgets.length > 0) {
                        const wRect = widgets[0].getRectangle();
                        rect = { x: wRect.x, y: wRect.y }; // Use the field's position
                        found = true;
                        console.log(`[PDF GEN] Found Pin '${fieldName}' at X=${rect.x}, Y=${rect.y}`);
                    }
                } catch (e) {
                    // Field not found
                }

                // 2. Fallback if Pin not found (Safety net)
                if (!found) {
                    console.warn(`[PDF GEN] Pin field '${fieldName}' NOT FOUND. Using fallback coordinates.`);
                    // Fallback to manual if user forgot to upload new PDF
                    if (fieldName === 'SIG_EIGENTUEMER') rect = { x: 330, y: 210 };
                    if (fieldName === 'SIG_MONTEUR') rect = { x: 40, y: 210 };
                }

                // 3. Embed and Draw (FIXED SIZE)
                const pngImageBytes = Buffer.from(sigBase64.split(',')[1], 'base64');
                const sigImage = await pdfDoc.embedPng(pngImageBytes);

                // Draw at the Pin's X,Y with offsets to center in the red boxes
                // PDF Coordinates: (0,0) is Bottom-Left. To move UP, we INCREASE Y.

                let yOffset = 35;   // Lowered from 60 to 35
                let xOffset = 0;

                // Special correction for Client signature which appears too far right
                if (fieldName === 'SIG_EIGENTUEMER') {
                    xOffset = -100; // Shift LEFT
                }

                firstPage.drawImage(sigImage, {
                    x: rect.x + xOffset,
                    y: rect.y + yOffset,
                    width: 140,     // Fixed width
                    height: 50      // Fixed height
                });
                console.log(`[PDF GEN] Success ${fieldName}: Drawn at ${rect.x + xOffset}, ${rect.y + yOffset} (Offsets: X=${xOffset}, Y=${yOffset})`);

            } catch (err) {
                console.error(`[PDF GEN] Error placing signature for ${fieldName}:`, err);
            }
        };

        await placeSignaturePin(clientSignature, 'SIG_EIGENTUEMER');
        await placeSignaturePin(techSignature, 'SIG_MONTEUR');

        // Added per user request: Tech signature at bottom (Text46)
        fill('Text46', cityDate, 7);
        await placeSignaturePin(techSignature, 'Text46');

        form.flatten(); // Flatten form fields to make them uneditable

        console.log('Fields filled and Signatures added. Saving PDF...');

        // Save
        const pdfBytes = await pdfDoc.save();

        // Sanitize filename
        const cleanName = `${street} ${number || ''}`.replace(/[^a-zA-Z0-9äöüÄÖÜß \-]/g, '').trim();
        const fileName = `${cleanName}.pdf`;

        const outDir = path.join(__dirname, '../../uploads/pdfs');

        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const outPath = path.join(outDir, fileName);
        fs.writeFileSync(outPath, pdfBytes);

        // Return public path (with timestamp for frontend display cache busting only)
        const publicPath = `uploads/pdfs/${fileName}`;
        res.json({ success: true, path: `${publicPath}?t=${Date.now()}` });
        console.log('--- END PDF GENERATION SUCCESS --- Saved to:', outPath);

    } catch (error) {
        console.error('--- PDF GENERATION ERROR ---');
        console.error(error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

// Sync Draft Progress (Team Collaboration)
exports.syncDraft = async (req, res) => {
    const { addressId } = req.params;
    const { 
        activationType, 
        familiesCount, 
        apPorts, 
        hasMoreClients, 
        spInstalled, 
        taInstalled, 
        mduInstalled, 
        homeIds, 
        description, 
        pdfPath,
        existingPhotos 
    } = req.body;

    const photos = Array.isArray(req.files) ? req.files.filter(f => f.fieldname === 'photos') : [];
    
    try {
        if (photos.length > 0) {
            const techUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true } });
            const techName = techUser?.username || 'Técnico JOA';
            await processImages(photos, techName);
        }

        const newPhotoPaths = photos.map(f => f.path.replace(/\\/g, '/'));
        let keptPhotos = [];
        if (existingPhotos) {
            try {
                keptPhotos = JSON.parse(existingPhotos);
            } catch (e) {
                keptPhotos = [];
            }
        }
        const allPhotos = [...keptPhotos, ...newPhotoPaths];

        // Fetch context for attribution
        const address = await prisma.address.findUnique({
            where: { id: addressId },
            include: { 
                activationInfo: true,
                appointment: { include: { assignedTeam: { include: { members: true } } } }
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { team: { include: { members: true } } }
        });

        // VALIDATE ENUM Values
        const validEnumValues = ['BP', 'BP_2_FAM', 'BR_MULTI', 'SDU', 'MDU'];
        const finalActivationType = validEnumValues.includes(activationType) ? activationType : 'BP';
        const finalCustomName = !validEnumValues.includes(activationType) ? activationType : (description || '');

        const draft = await prisma.activationInfo.upsert({

            where: { addressId },
            update: {
                activationType: finalActivationType,
                customActivationName: finalCustomName,
                familiesCount: familiesCount ? parseInt(familiesCount) : undefined,
                apPorts: apPorts ? parseInt(apPorts) : undefined,
                hasMoreClients: hasMoreClients === 'true' || hasMoreClients === true ? true : (hasMoreClients === 'false' || hasMoreClients === false ? false : undefined),
                spInstalled: spInstalled ? parseInt(spInstalled) : undefined,
                taInstalled: taInstalled === 'true' || taInstalled === true ? true : (taInstalled === 'false' || taInstalled === false ? false : undefined),
                mduInstalled: mduInstalled === 'true' || mduInstalled === true ? true : (mduInstalled === 'false' || mduInstalled === false ? false : undefined),
                homeIds: homeIds ? (Array.isArray(homeIds) ? homeIds : (typeof homeIds === 'string' ? JSON.parse(homeIds) : homeIds)) : undefined,
                description: description || undefined,
                pdfPath: (pdfPath === 'null' || !pdfPath) ? null : pdfPath,
                photos: allPhotos,
                isDraft: true,
                points: 0,
                // --- NEW: Attribution in Drafts ---
                createdById: address.activationInfo?.createdById || (req.userRole === 'ADMIN' || req.userRole === 'SUPER_ADMIN' ? (address.appointment?.assignedTeam?.members[0]?.id || req.userId) : req.userId),
                performerIds: address.activationInfo?.performerIds?.length > 0 
                    ? address.activationInfo.performerIds 
                    : (address.appointment?.assignedTeam?.members.map(m => m.id) || user?.team?.members.map(m => m.id) || [req.userId]),
            },
            create: {
                addressId,
                activationType: finalActivationType,
                customActivationName: finalCustomName,
                familiesCount: familiesCount ? parseInt(familiesCount) : 1,
                apPorts: apPorts ? parseInt(apPorts) : 1,
                hasMoreClients: hasMoreClients === 'true' || hasMoreClients === true,
                spInstalled: spInstalled ? parseInt(spInstalled) : 0,
                taInstalled: taInstalled === 'true' || taInstalled === true,
                mduInstalled: mduInstalled === 'true' || mduInstalled === true,
                homeIds: homeIds ? (Array.isArray(homeIds) ? homeIds : (typeof homeIds === 'string' ? JSON.parse(homeIds) : homeIds)) : [],
                description: description || '',
                pdfPath: pdfPath || null,
                photos: allPhotos,
                isDraft: true,
                points: 0,
                createdById: (req.userRole === 'ADMIN' || req.userRole === 'SUPER_ADMIN' ? (address.appointment?.assignedTeam?.members[0]?.id || req.userId) : req.userId),
                performerIds: (address.appointment?.assignedTeam?.members.map(m => m.id) || user?.team?.members.map(m => m.id) || [req.userId]),
            }

        });

        res.json({ success: true, draft });
    } catch (error) {
        console.error('Error syncing draft:', error);
        res.status(500).json({ message: 'Error al sincronizar borrador' });
    }
};

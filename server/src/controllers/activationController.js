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
                AND: [
                    {
                        OR: [
                            { assignedTeamId: null },
                            { assignedTeamId: teamId }
                        ]
                    },
                    {
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
        homeId,
        isActivated,
        notActivatedReason,
        clientSignature,
        techSignature
    } = req.body;

    // Con upload.any(), req.files es un array plano en lugar de un objeto con claves
    const photos = Array.isArray(req.files) ? req.files.filter(f => f.fieldname === 'photos') : [];
    const signedPdfFile = Array.isArray(req.files) ? req.files.find(f => f.fieldname === 'signedPdf') : null;

    if (signedPdfFile) {
        pdfPath = signedPdfFile.path.replace(/\\/g, '/');
    }

    const validEnumValues = ['BP', 'BP_2_FAM', 'BR_MULTI', 'SDU', 'MDU'];
    const finalActivationType = validEnumValues.includes(activationType) ? activationType : 'BP';
    const customActivationName = !validEnumValues.includes(activationType) ? activationType : null;


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

        // Regenerate PDF if signatures are provided (ensuring final comments are embedded)
        if (clientSignature && techSignature) {
            try {
                console.log('[SubmitActivation] Regenerating PDF with final description and signatures...');
                const activeUsername = user ? user.username : (req.body.username || '');
                const activePhone = user ? user.phone : (req.body.userPhone || '');
                
                const newPdfPath = await generatePdfInternal({
                    addressId,
                    clientName: address.clientName,
                    street: address.street,
                    number: address.number,
                    city: address.city,
                    klsId: klsId || address.klsId,
                    clientSignature,
                    techSignature,
                    description,
                    activeUsername,
                    activePhone
                });
                pdfPath = newPdfPath;
                console.log('[SubmitActivation] PDF regenerated successfully:', pdfPath);
            } catch (pdfErr) {
                console.error('[SubmitActivation] Non-critical PDF regeneration error:', pdfErr.message);
            }
        }

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

        const finalDate = (address.activationInfo && !address.activationInfo.isDraft) 
            ? new Date(address.activationInfo.createdAt) 
            : new Date();

        const isSaturday = req.body.isSaturday === 'true' || req.body.isSaturday === true || (finalDate.getDay() === 6);

        // Financials (Snapshot)
        let basePrice = parseFloat(fin.pricePerUnit || 60);
        let saturdayPay = 0;

        // Try to find specific prices in ClientPriceItems
        // Try to find exact specific prices in ClientPriceItems BY NAME first, then fallback to legacy mapping
        let matchingItem = priceItems.find(item => item.name === activationType || (customActivationName && item.name === customActivationName));

        if (!matchingItem) {
            matchingItem = priceItems.find(item => {
                const searchName = (item.name || '').toLowerCase();
                if (activationType === 'BP' || activationType === 'BP_2_FAM') {
                    return searchName.includes('caja') || searchName.includes('bp') || searchName.includes('unifamiliar');
                }
                if (activationType === 'SDU') return searchName.includes('sdu') || searchName.includes('ta');
                if (activationType === 'MDU') return searchName.includes('mdu');
                if (activationType === 'BR_MULTI') return searchName.includes('br') || searchName.includes('multi');
                return false;
            });
        }


        if (matchingItem) {
            basePrice = matchingItem.priceToClient;
            if (isSaturday) {
                saturdayPay += (matchingItem.saturdayPay || 0); // Incrementar en vez de asignar
            }
        }

        let spDynamicPrice = 0;
        const spItem = priceItems.find(item => {
            const name = (item.name || '').toLowerCase();
            return name === 'sp' || name.includes('sp');
        });
        if (spItem && spItem.priceToClient !== undefined) {
            spDynamicPrice = spItem.priceToClient;
        } else if (priceItems.length === 0) {
            spDynamicPrice = parseFloat(fin.pricePerSP || 75);
        }
        const totalSpPrice = spCount * spDynamicPrice;

        let taPriceTotal = 0;
        let sduDynamicPrice = 0;
        const sduItem = priceItems.find(item => {
            const name = (item.name || '').toLowerCase();
            return name === 'sdu' || name === 'ta' || name.includes('ta') || name.includes('sdu');
        });
        if (sduItem && sduItem.priceToClient !== undefined) {
            sduDynamicPrice = sduItem.priceToClient;
        } else if (priceItems.length === 0) {
            sduDynamicPrice = parseFloat(fin.pricePerTA || 25);
        }
        const finalTaCountCalculated = taInstalledBool ? (taCountInt > 0 ? taCountInt : 1) : 0;
        if (finalTaCountCalculated > 0) {
            taPriceTotal = finalTaCountCalculated * sduDynamicPrice;
            if (isSaturday && sduItem && sduItem.saturdayPay) {
                saturdayPay += ((sduItem.saturdayPay || 0) * finalTaCountCalculated);
            }
        }

        let mduPriceTotal = 0;
        let mduDynamicPrice = 0;
        const mduItem = priceItems.find(item => {
            const name = (item.name || '').toLowerCase();
            return name === 'mdu' || name.includes('mdu');
        });
        if (mduItem && mduItem.priceToClient !== undefined) {
            mduDynamicPrice = mduItem.priceToClient;
        } else if (priceItems.length === 0) {
            mduDynamicPrice = parseFloat(fin.pricePerMDU || 50);
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

        const isActivatedBool = isActivated === 'true' || isActivated === true || isActivated === undefined;
        const notActivatedReasonStr = notActivatedReason || '';

        const result = await prisma.$transaction(async (tx) => {
            if (klsId) {
                await tx.address.update({
                    where: { id: addressId },
                    data: { klsId }
                });
            }

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
            // If it was already closed, we MUST preserve the original date.
            if (address.activationInfo && address.activationInfo.isDraft) {
                data.createdAt = new Date();
            } else if (address.activationInfo) {
                // Explicitly preserve original date if editing a closed one
                data.createdAt = address.activationInfo.createdAt;
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

            if (isActivatedBool) {
                // Use updateMany to safely update if exists, or do nothing if not, preventing 500 errors
                await tx.appointment.updateMany({
                    where: { addressId },
                    data: { status: 'COMPLETADO' }
                });

                await tx.address.update({
                    where: { id: addressId },
                    data: { orderStatus: 'Installiert' }
                });
            } else {
                // Mark as RECITAR
                await tx.appointment.updateMany({
                    where: { addressId },
                    data: { status: 'RECITAR' }
                });

                await tx.address.update({
                    where: { id: addressId },
                    data: { orderStatus: 'geplant' } // Return to planned/pending state
                });

                // Get the appointment to create a comment under it
                const appObj = await tx.appointment.findUnique({
                    where: { addressId }
                });

                if (appObj) {
                    await tx.comment.create({
                        data: {
                            appointmentId: appObj.id,
                            content: `[NO ACTIVADO - REQUIERE NUEVA CITA] Motivo: ${notActivatedReasonStr || 'No especificado'}`,
                            authorName: user?.username || 'Técnico',
                            photos: allPhotos
                        }
                    });
                }
            }

            return activation;
        });

        // --- NOTIFICATION LOGIC (WRAPPED IN TRY-CATCH TO PREVENT 500s) ---
        try {
            const [notifAddress, notifUser] = await Promise.all([
                prisma.address.findUnique({ where: { id: addressId }, include: { project: true } }),
                prisma.user.findUnique({ where: { id: req.userId }, select: { username: true } })
            ]);

            if (notifAddress && notifUser) {
                const projectName = notifAddress.project?.name || 'Proyecto Desconocido';
                
                if (isActivatedBool) {
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
                        data: { 
                            addressId: addressId,
                            url: `/dashboard/activations?editAddressId=${addressId}`
                        }
                    }).catch(e => console.error('Push error:', e.message));
                } else {
                    const notificationMsg = `🚩 [NO ACTIVADO] ${notifUser.username} indica que en ${notifAddress.street} ${notifAddress.number} (${projectName}) no quedó activada. Requiere nueva cita. Motivo: ${notActivatedReasonStr || 'No especificado'}`;
                    
                    await prisma.notification.create({
                        data: {
                            type: 'RECITE_REQUEST',
                            message: notificationMsg,
                            addressId: addressId,
                            createdById: req.userId,
                            targetRole: 'BACK_OFFICE'
                        }
                    });

                    sendPushToRole('BACK_OFFICE', {
                        title: '🚩 Nueva cita requerida',
                        body: notificationMsg,
                        data: { 
                            addressId: addressId,
                            url: `/dashboard/appointments?view=recita`
                        }
                    }).catch(e => console.error('Push error:', e.message));
                }
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

const generatePdfInternal = async ({
    addressId,
    clientName,
    street,
    number,
    city,
    klsId,
    clientSignature,
    techSignature,
    description,
    activeUsername,
    activePhone
}) => {
    // Load PDF
    const pdfTemplatePath = path.join(__dirname, '../../templates/dokumentation von GlasfaserPlus.pdf');
    console.log('Looking for PDF template at:', pdfTemplatePath);

    if (!fs.existsSync(pdfTemplatePath)) {
        throw new Error(`Template PDF not found at: ${pdfTemplatePath}`);
    }

    console.log('PDF Template found. Reading file...');
    const existingPdfBytes = fs.readFileSync(pdfTemplatePath);

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
            // Ignore
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
    fill('Text12', activePhone);
    fill('Text14', klsId);

    fill('Text42', cityDate, 7);
    fill('Text43', cityDate, 7);

    let translatedAbweichung = '';
    if (description && description.trim() !== '') {
        try {
            const { translate } = await import('@vitalets/google-translate-api');
            const translationReq = await translate(description, { to: 'de' });
            translatedAbweichung = translationReq.text;
            console.log('[PDF GEN] Translated comment to German:', translatedAbweichung);
        } catch(e) {
            console.error('[PDF GEN] Translation failed:', e);
            translatedAbweichung = description; // Fallback to original
        }
    }

    fill('Text1', translatedAbweichung);

    const placeSignaturePin = async (sigBase64, fieldName) => {
        if (!sigBase64) {
            console.warn(`[PDF GEN] No signature data for ${fieldName}`);
            return;
        }

        try {
            let rect = { x: 0, y: 0 };
            let found = false;

            try {
                const sigField = form.getTextField(fieldName);
                const widgets = sigField.getWidgets();
                if (widgets && widgets.length > 0) {
                    const wRect = widgets[0].getRectangle();
                    rect = { x: wRect.x, y: wRect.y };
                    found = true;
                }
            } catch (e) {
                // Ignore
            }

            if (!found) {
                console.warn(`[PDF GEN] Pin field '${fieldName}' NOT FOUND. Using fallback coordinates.`);
                if (fieldName === 'SIG_EIGENTUEMER') rect = { x: 330, y: 210 };
                if (fieldName === 'SIG_MONTEUR') rect = { x: 40, y: 210 };
            }

            const pngImageBytes = Buffer.from(sigBase64.split(',')[1], 'base64');
            const sigImage = await pdfDoc.embedPng(pngImageBytes);

            let yOffset = 35;
            let xOffset = 0;

            if (fieldName === 'SIG_EIGENTUEMER') {
                xOffset = -100;
            }

            firstPage.drawImage(sigImage, {
                x: rect.x + xOffset,
                y: rect.y + yOffset,
                width: 140,
                height: 50
            });
        } catch (err) {
            console.error(`[PDF GEN] Error placing signature for ${fieldName}:`, err);
        }
    };

    await placeSignaturePin(clientSignature, 'SIG_EIGENTUEMER');
    await placeSignaturePin(techSignature, 'SIG_MONTEUR');

    fill('Text46', cityDate, 7);
    await placeSignaturePin(techSignature, 'Text46');

    form.flatten();

    const pdfBytes = await pdfDoc.save();
    const cleanName = `${street} ${number || ''}`.replace(/[^a-zA-Z0-9äöüÄÖÜß \-]/g, '').trim();
    const fileName = `${cleanName}.pdf`;
    const outDir = path.join(__dirname, '../../uploads/pdfs');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, pdfBytes);

    return `uploads/pdfs/${fileName}`;
};

exports.generatePdf = async (req, res) => {
    console.log('--- STARTING PDF GENERATION ---');
    try {
        const { addressId, clientName, street, number, city, klsId, clientSignature, techSignature, description } = req.body;
        console.log('Request body:', { addressId, clientName, street, number, city, klsId, hasClientSig: !!clientSignature, hasTechSig: !!techSignature, hasDescription: !!description });

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { username: true, phone: true }
        });
        console.log('User found:', user);

        const activeUsername = user ? user.username : (req.body.username || '');
        const activePhone = user ? user.phone : (req.body.userPhone || '');

        const publicPath = await generatePdfInternal({
            addressId,
            clientName,
            street,
            number,
            city,
            klsId,
            clientSignature,
            techSignature,
            description,
            activeUsername,
            activePhone
        });

        res.json({ success: true, path: `${publicPath}?t=${Date.now()}` });
        console.log('--- END PDF GENERATION SUCCESS --- Saved to:', publicPath);

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
        const finalCustomName = !validEnumValues.includes(activationType) ? activationType : null;

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
                isDraft: address.activationInfo ? address.activationInfo.isDraft : true, // Preserve closed status if already closed
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
                isDraft: true, // New ones are always drafts initially
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

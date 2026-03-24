const prisma = require('../prisma');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { processImages } = require('../utils/imageProcessor');

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

        if (!user.teamId) {
            return res.status(400).json({ message: 'User is not assigned to a team' });
        }

        const appointments = await prisma.appointment.findMany({
            where: {
                assignedTeamId: user.teamId,
                status: { in: ['CITADO', 'COMPLETADO'] }
            },
            include: {
                address: {
                    include: {
                        project: true,
                        activationInfo: true
                    }
                }
            },
            orderBy: { assignedDate: 'desc' },
            take: 50 // Limit to last 50 to avoid clutter
        });

        res.json(appointments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching appointments' });
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

    const photos = req.files && req.files['photos'] ? req.files['photos'] : [];
    const signedPdfFile = req.files && req.files['signedPdf'] ? req.files['signedPdf'][0] : null;

    if (signedPdfFile) {
        pdfPath = signedPdfFile.path.replace(/\\/g, '/');
    }

    // 🟢 COMPRESIÓN DE IMÁGENES
    if (photos.length > 0) {
        await processImages(photos);
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
        const taInstalledBool = taInstalled === 'true' || taInstalled === true;

        // Fetch System Settings
        const settings = await prisma.systemSettings.findFirst();
        const fin = settings?.financials?.installers || {};

        // Financials (Snapshot)
        let basePrice = parseFloat(fin.pricePerUnit || 60);
        const pricePerSP = parseFloat(fin.pricePerSP || 75);
        const totalSpPrice = spCount * pricePerSP;

        let taPriceTotal = 0;
        const pricePerTA = parseFloat(fin.pricePerTA || 25);
        if (taCountInt > 0) taPriceTotal = taCountInt * pricePerTA;

        let mduPriceTotal = 0;
        const pricePerMDU = parseFloat(fin.pricePerMDU || 50);
        if (isMduBool) mduPriceTotal = pricePerMDU;

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

        const finalTaCount = taCountInt > 0 ? taCountInt : (taInstalledBool ? 1 : 0);
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

        const isSaturday = new Date().getDay() === 6;

        const result = await prisma.$transaction(async (tx) => {
            if (klsId) {
                await tx.address.update({
                    where: { id: addressId },
                    data: { klsId }
                });
            }

            const data = {
                activationType,
                familiesCount: famCount,
                apPorts: apPortsInt,
                hasMoreClients: hasMoreClients === 'true' || hasMoreClients === true,
                spInstalled: spCount,
                taInstalled: taInstalledBool || taCountInt > 0,
                taCount: taCountInt,
                mduInstalled: isMduBool,
                isRepair: isRepairBool,
                homeIds: homeIdsArray,
                description,
                points,
                isSaturday,
                basePrice,
                spPrice: totalSpPrice,
                taPrice: taPriceTotal,
                mduPrice: mduPriceTotal,
                repairPrice: repairPriceTotal,
                pdfPath: pdfPath ? pdfPath.split('?')[0] : null, // Clean query string before saving to DB
                photos: allPhotos
            };

            const activation = await tx.activationInfo.upsert({
                where: { addressId },
                update: data,
                create: {
                    addressId,
                    ...data
                }
            });

            await tx.appointment.update({
                where: { addressId },
                data: { status: 'COMPLETADO' }
            });

            await tx.address.update({
                where: { id: addressId },
                data: { orderStatus: 'Installiert' }
            });

            return activation;
        });

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
            where.address = {
                appointment: {
                    assignedTeamId: teamId
                }
            };
        }

        if (projectId) {
            where.address = {
                ...where.address,
                projectId: projectId
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

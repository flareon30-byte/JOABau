const prisma = require('../prisma');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

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
        activationType = 'BP', // Default
        familiesCount = 1,     // Default
        apPorts,
        hasMoreClients = false,
        spInstalled,
        taInstalled,
        taCount,
        homeIds,
        description,
        isMDU,
        // New fields
        klsId,
        pdfPath // Might be passed from frontend if generated but not uploaded
    } = req.body;

    // req.files is now an object { photos: [], signedPdf: [] }
    const photos = req.files && req.files['photos'] ? req.files['photos'] : [];
    const signedPdfFile = req.files && req.files['signedPdf'] ? req.files['signedPdf'][0] : null;

    if (signedPdfFile) {
        // If a signed PDF is uploaded, it takes precedence
        pdfPath = signedPdfFile.path.replace(/\\/g, '/');
    }

    try {
        // Update Address with KLS ID if provided
        if (klsId) {
            await prisma.address.update({
                where: { id: addressId },
                data: { klsId }
            });
        }

        const photoPaths = photos.map(f => f.path);

        // Parse homeIds (expecting JSON string)
        let homeIdsArray = [];
        try {
            homeIdsArray = JSON.parse(homeIds || '[]');
        } catch (e) {
            homeIdsArray = [homeIds]; // Fallback if single string
        }

        // Parse existingPhotos safely
        let keptPhotos = [];
        try {
            if (req.body.existingPhotos) {
                keptPhotos = JSON.parse(req.body.existingPhotos);
            }
        } catch (e) {
            console.error('Error parsing existing photos', e);
        }

        const allPhotos = [...keptPhotos, ...photoPaths];

        const famCount = parseInt(familiesCount);
        const spCount = parseInt(spInstalled || 0);
        const taCountInt = parseInt(taCount || 0);
        const mdu = isMDU === 'true';

        // Fetch System Settings for Point Values
        const settings = await prisma.systemSettings.findFirst();

        // Default points if settings not found
        const pointsConfig = {
            'BP': settings?.bpPoints || 10,
            'BP_2_FAM': settings?.bp2FamPoints || 15,
            'BR_MULTI': settings?.brMultiPoints || 20,
            'SDU': settings?.sduPoints || 25,
            'MDU': settings?.mduPoints || 30,
            'SP': settings?.spPoints || 5,
            'TA': settings?.sduPoints || 25
        };

        // Points Calculation
        let points = 0;

        // Base points based on activation type
        if (pointsConfig[activationType]) {
            points += pointsConfig[activationType];
        }

        // Add points for SPs installed
        if (spCount > 0) {
            points += (spCount * pointsConfig['SP']);
        }

        // Add points for TAs installed
        // Add points for TAs installed
        const taInstalledBool = taInstalled === 'true' || taInstalled === true;
        const finalTaCount = parseInt(taCount || 0) > 0 ? parseInt(taCount || 0) : (taInstalledBool ? 1 : 0);

        if (finalTaCount > 0) {
            // Determine TA Point Value based on Activation Type
            let taPointValue = pointsConfig['SDU']; // Default

            if (activationType === 'BP') {
                taPointValue = pointsConfig['SDU'];
            } else if (['BP_2_FAM', 'BR_MULTI'].includes(activationType)) {
                taPointValue = pointsConfig['MDU'];
            }

            points += (finalTaCount * taPointValue);
        }

        // Saturday Check
        const isSaturday = new Date().getDay() === 6;

        const result = await prisma.$transaction(async (prisma) => {
            // 1. Upsert ActivationInfo
            const data = {
                activationType,
                familiesCount: famCount,
                apPorts: parseInt(apPorts || 0),
                hasMoreClients: hasMoreClients === 'true',
                spInstalled: spCount,
                taInstalled: taInstalled === 'true' || taCountInt > 0,
                taCount: taCountInt,
                homeIds: homeIdsArray,
                description,
                points,
                isSaturday,
                pdfPath, // Save generated PDF path
                photos: allPhotos // Set the photos list directly
            };

            const activation = await prisma.activationInfo.upsert({
                where: { addressId },
                update: data, // Update with full data including new photo list
                create: {
                    addressId,
                    ...data
                }
            });

            // 2. Update Appointment Status
            await prisma.appointment.update({
                where: { addressId },
                data: { status: 'COMPLETADO' }
            });

            // 3. Update Address OrderStatus to remove from Soplado list
            await prisma.address.update({
                where: { id: addressId },
                data: { orderStatus: 'Installiert' }
            });

            return activation;
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting activation' });
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
    try {
        const { addressId, clientName, street, number, city, klsId } = req.body;

        // Fetch User details (Phone, Username) safely from DB
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { username: true, phone: true }
        });

        const activeUsername = user ? user.username : (req.body.username || '');
        const activePhone = user ? user.phone : (req.body.userPhone || '');

        // Load PDF
        const pdfPath = path.join(__dirname, '../../../dokumentation von GlasfaserPlus.pdf');
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ message: 'Template PDF not found' });
        }

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

        fill('Text1', ''); // Clear Abweichung (Big Box) - Identified as Text1

        fill('Text46', cityDate, 7);  // Monteur Bottom - Identified as Text46
        fill('Text17', ''); // Safety Clear
        fill('Text18', ''); // Safety Clear

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

        // Return public path (add timestamp query to prevent caching)
        res.json({ success: true, path: `uploads/pdfs/${fileName}?t=${Date.now()}` });

    } catch (error) {
        console.error('PDF Gen Error:', error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

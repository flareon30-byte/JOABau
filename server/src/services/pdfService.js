const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Generates a professional Installation PDF report matching the MUENET style.
 * @param {Object} installation - The SimpleInstallation record with inclusions (address, createdBy, items)
 */
exports.generateInstallationReport = async (installation) => {
    try {
        console.log(`[PDF Service] Starting report generation for installation ${installation.id}`);
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // --- ASSETS ---
        let logoImage;
        const logoPath = path.join(__dirname, '../../../client/public/logo.png');
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            logoImage = await pdfDoc.embedPng(logoBytes);
        }

        const addHeader = (page) => {
            const { width, height } = page.getSize();
            // Company Name
            page.drawText('JOA Technologien', { x: 50, y: height - 50, size: 18, font: fontBold });
            // Logo
            if (logoImage) {
                const dims = logoImage.scale(0.08); // Scale down
                page.drawImage(logoImage, {
                    x: width - dims.width - 50,
                    y: height - 65,
                    width: dims.width,
                    height: dims.height,
                });
            }
            // Horizontal Line
            page.drawLine({
                start: { x: 50, y: height - 75 },
                end: { x: width - 50, y: height - 75 },
                thickness: 1,
                color: rgb(0, 0, 0),
            });
        };

        const drawLabelValue = (page, x, y, label, value) => {
            page.drawText(`${label} :`, { x, y, size: 10, font: fontBold });
            page.drawText(String(value || '-'), { x: x + 120, y, size: 10, font: font });
        };

        // --- PAGE 1: INFO & HÜP ---
        const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
        addHeader(page1);
        const { height: p1Height } = page1.getSize();

        page1.drawText('Installationsbericht', { 
            x: 595.28 / 2 - 100, 
            y: p1Height - 110, 
            size: 20, 
            font: fontBold 
        });

        let currentY = p1Height - 150;
        const rowStep = 20;

        drawLabelValue(page1, 50, currentY, 'Name', installation.customerLastName); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Vorname', installation.customerFirstName); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Datum / Zeit', new Date(installation.createdAt).toLocaleString('de-DE')); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Kunden Auswahl', installation.address?.clientName || installation.contactName); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Benutzer', installation.createdBy?.username); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Straße', `${installation.address?.street} ${installation.address?.number || ''}, ${installation.address?.city || ''}`); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'OLT', installation.olt); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'PON', installation.pon); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Splitter Port', installation.splitterPort); currentY -= rowStep;
        drawLabelValue(page1, 50, currentY, 'Gpon Seriennummer', installation.gponSerialNumber); currentY -= 30;

        // Photo HÜP
        if (installation.photoHuep) {
            page1.drawText('Foto HÜP (offen) :', { x: 50, y: currentY, size: 10, font: fontBold });
            currentY -= 15;
            await embedImage(pdfDoc, page1, installation.photoHuep, 50, currentY - 300, 400, 300);
            currentY -= 320;
        }

        // --- PAGE 2: MODEM & OTDR ---
        const page2 = pdfDoc.addPage([595.28, 841.89]);
        addHeader(page2);
        let p2Y = 841.89 - 100;

        if (installation.photoModem) {
            page2.drawText('Foto Modem :', { x: 50, y: p2Y, size: 10, font: fontBold });
            p2Y -= 15;
            await embedImage(pdfDoc, page2, installation.photoModem, 50, p2Y - 250, 350, 250);
            p2Y -= 280;
        }

        if (installation.photoOtdr) {
            page2.drawText('Foto OTDR :', { x: 50, y: p2Y, size: 10, font: fontBold });
            p2Y -= 15;
            await embedImage(pdfDoc, page2, installation.photoOtdr, 50, p2Y - 250, 350, 250);
            p2Y -= 280;
        }

        // Footer info on Page 2
        p2Y -= 20;
        const lat = installation.gpsLat?.toFixed(6) || '-';
        const lng = installation.gpsLng?.toFixed(6) || '-';
        const alt = installation.gpsAlt?.toFixed(2) || '-';
        
        page2.drawText(`Geolokalisierung : Breitengrad : ${lat}, Längengrad : ${lng}, Höhenmeter : ${alt}`, { x: 50, y: p2Y, size: 9, font: font, color: rgb(0, 0, 1) }); p2Y -= 20;
        drawLabelValue(page2, 50, p2Y, 'Anschluss betriebsbereit', installation.isReadyForOperation ? 'Ja' : 'Nein'); p2Y -= 20;
        drawLabelValue(page2, 50, p2Y, 'Bemerkung', installation.comments);

        // --- PAGE 3: SIGNATURE ---
        const page3 = pdfDoc.addPage([595.28, 841.89]);
        addHeader(page3);
        let p3Y = 841.89 - 100;

        page3.drawText('Unterschrift :', { x: 50, y: p3Y, size: 10, font: fontBold });
        if (installation.signaturePath) {
            p3Y -= 15;
            await embedImage(pdfDoc, page3, installation.signaturePath, 50, p3Y - 200, 400, 200, true);
        }

        // Finalize
        const pdfBytes = await pdfDoc.save();
        const fileName = `Report_${installation.customerLastName || 'Inst'}_${new Date().getTime()}.pdf`;
        const dir = path.join(__dirname, '../../uploads/reports');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, pdfBytes);
        
        return `/uploads/reports/${fileName}`;

    } catch (error) {
        console.error('[PDF Service] Error generating report:', error);
        throw error;
    }
};

/**
 * Helper to embed images safely
 */
async function embedImage(pdfDoc, page, relativePath, x, y, width, height, isPng = false) {
    try {
        const fullPath = path.join(__dirname, '../../', relativePath.split('?')[0]);
        if (!fs.existsSync(fullPath)) {
            console.warn(`[PDF Service] Image missing: ${fullPath}`);
            return;
        }
        const imgBytes = fs.readFileSync(fullPath);
        let img;
        if (fullPath.toLowerCase().endsWith('.png') || isPng) {
            img = await pdfDoc.embedPng(imgBytes);
        } else {
            img = await pdfDoc.embedJpg(imgBytes);
        }

        // Maintain aspect ratio
        const dims = img.scale(1);
        const ratio = Math.min(width / dims.width, height / dims.height);
        
        page.drawImage(img, {
            x,
            y,
            width: dims.width * ratio,
            height: dims.height * ratio,
        });
    } catch (e) {
        console.error(`[PDF Service] Failed to embed image ${relativePath}:`, e);
    }
}

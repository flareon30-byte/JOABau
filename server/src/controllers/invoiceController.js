const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const prisma = require('../prisma');

// Helper para formatear moneda
const money = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);

const generatePdfFile = (invoice, client, company) => {
    return new Promise((resolve, reject) => {
        const fileName = `factura_${invoice.number}.pdf`;
        const uploadsDir = path.join(__dirname, '../../uploads/invoices');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        
        const filePath = path.join(uploadsDir, fileName);
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4',
            bufferPages: true 
        });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // --- Helper: Cabecera de Página ---
        const generateHeader = (doc) => {
            // Usar el logo oficial de CompanySettings
            const logoRelativePath = company.logoPath; 
            const logoPath = logoRelativePath ? path.join(__dirname, '../../', logoRelativePath) : null;
            
            if (logoPath && fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 45, { width: 120 });
            } 

            // Nombre de la Empresa (Elegante y sin solaparse)
            doc.fillColor('#0052cc').fontSize(13).font('Helvetica-Bold').text(company.name.toUpperCase(), 300, 45, { align: 'right', width: 245 });

            doc.fillColor('#444444').fontSize(9).font('Helvetica');
            doc.text(company.address || '', 300, 75, { align: 'right', width: 245 });
            doc.text(`CIF: ${company.taxId || ''}`, 300, 88, { align: 'right', width: 245 });
            doc.text(`${company.email || ''}`, 300, 101, { align: 'right', width: 245 });
            doc.text(`${company.phone || ''}`, 300, 114, { align: 'right', width: 245 });
            
            doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#eeeeee').lineWidth(1).stroke();
        };

        // --- Helper: Footer con Paginación ---
        const generateFooter = (doc) => {
            doc.fontSize(8).fillColor('#aaaaaa').text(
                'JOA Technologien - Innovación y Calidad en Telecomunicaciones',
                50, 780, { align: 'center', width: 500 }
            );
        };

        // --- Primera Página ---
        generateHeader(doc);

        // Datos Cliente e Info Factura
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('CLIENTE:', 50, 150);
        doc.fontSize(12).text(client.legalName || client.name, 50, 165);
        doc.fontSize(10).font('Helvetica').fillColor('#444444');
        doc.text(client.address || '', 50, 185, { width: 200 });
        doc.text(`CIF/VAT: ${client.taxId || ''}`, 50, 215);

        // Caja de Info Factura (Derecha)
        doc.rect(350, 150, 195, 75).fill('#f8faff');
        doc.fillColor('#0052cc').fontSize(12).font('Helvetica-Bold').text('DATOS FACTURA', 365, 160);
        doc.fillColor('#444444').fontSize(9).font('Helvetica');
        doc.text(`Nº Factura:`, 365, 180);
        doc.font('Helvetica-Bold').text(invoice.number, 440, 180);
        doc.font('Helvetica').text(`Fecha:`, 365, 192);
        doc.text(new Date(invoice.date).toLocaleDateString('es-ES'), 440, 192);
        doc.text(`Vencimiento:`, 365, 204);
        doc.text(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-ES') : '-', 440, 204);

        // --- Tabla de Items ---
        let tableTop = 260;
        const drawTableHeader = (y) => {
            doc.rect(50, y, 495, 25).fill('#0052cc');
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
            doc.text('Descripción del Servicio', 65, y + 8);
            doc.text('Cant.', 350, y + 8, { width: 40, align: 'center' });
            doc.text('Precio', 400, y + 8, { width: 60, align: 'right' });
            doc.text('Total', 475, y + 8, { width: 60, align: 'right' });
        };

        drawTableHeader(tableTop);
        doc.font('Helvetica').fontSize(9).fillColor('#333333');
        
        let position = tableTop + 30;
        let itemsProcessed = 0;

        invoice.items.forEach((item, index) => {
            // Control de Salto de Página
            if (position > 720) {
                doc.addPage();
                generateHeader(doc);
                tableTop = 150;
                drawTableHeader(tableTop);
                position = tableTop + 30;
                doc.font('Helvetica').fontSize(9).fillColor('#333333');
            }

            // Fondo alterno para filas
            if (index % 2 === 0) {
                doc.rect(50, position - 5, 495, 20).fill('#fcfcfc');
            }

            doc.fillColor('#333333');
            doc.text(item.desc, 65, position, { width: 280, height: 15, ellipsis: true });
            doc.text(item.qty.toString(), 350, position, { width: 40, align: 'center' });
            doc.text(money(item.price), 400, position, { width: 60, align: 'right' });
            doc.text(money(item.total), 475, position, { width: 60, align: 'right' });
            
            position += 20;
            itemsProcessed++;
        });

        // --- Bloque de Totales ---
        // Si no cabe en la misma página, saltar
        if (position > 650) {
            doc.addPage();
            generateHeader(doc);
            position = 150;
        }

        const totalsStart = 400;
        const totalsY = position + 30;

        doc.moveTo(totalsStart, totalsY).lineTo(545, totalsY).strokeColor('#eeeeee').stroke();
        
        doc.fontSize(10).font('Helvetica').fillColor('#666666');
        doc.text('Base Imponible:', totalsStart, totalsY + 15);
        doc.fillColor('#333333').text(money(invoice.subtotal), 475, totalsY + 15, { align: 'right', width: 70 });

        doc.fillColor('#666666').text(`IVA (${client.defaultVat}%):`, totalsStart, totalsY + 30);
        doc.fillColor('#333333').text(money(invoice.vatAmount), 475, totalsY + 30, { align: 'right', width: 70 });

        doc.rect(totalsStart - 10, totalsY + 50, 155, 35).fill('#0052cc');
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
        doc.text('TOTAL:', totalsStart, totalsY + 62);
        doc.text(money(invoice.total), 465, totalsY + 62, { align: 'right', width: 70 });

        // Datos de Pago
        doc.fillColor('#333333').fontSize(10).font('Helvetica-Bold').text('INFORMACIÓN DE PAGO', 50, totalsY + 15);
        doc.fontSize(9).font('Helvetica').fillColor('#666666');
        doc.text(`Banco: ${company.bankDetails || 'Transferencia Bancaria'}`, 50, totalsY + 35);
        doc.text(`Referencia: Factura ${invoice.number}`, 50, totalsY + 47);

        // Finalizar
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            generateFooter(doc);
            doc.fontSize(8).fillColor('#aaaaaa').text(`Página ${i + 1} de ${range.count}`, 50, 795, { align: 'right', width: 495 });
        }

        doc.end();
        stream.on('finish', () => resolve(`/uploads/invoices/${fileName}`));
        stream.on('error', reject);
    });
};

exports.getPendingWork = async (req, res) => {
    const { clientId, startDate, endDate } = req.query;
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Buscar TODA la producción del cliente sin facturar
        const [activations, soplados, fusions, installations] = await Promise.all([
            prisma.activationInfo.findMany({
                where: { 
                    invoiceId: null, 
                    createdAt: { gte: start, lte: end },
                    address: { project: { clientCompanyId: clientId } } 
                },
                include: { address: true }
            }),
            prisma.sopladoInfo.findMany({
                where: { 
                    invoiceId: null, 
                    createdAt: { gte: start, lte: end },
                    address: { project: { clientCompanyId: clientId } } 
                },
                include: { address: true }
            }),
            prisma.fusionWork.findMany({
                where: { 
                    invoiceId: null, 
                    createdAt: { gte: start, lte: end },
                    project: { clientCompanyId: clientId } 
                }
            }),
            prisma.simpleInstallation.findMany({
                where: { 
                    invoiceId: null, 
                    createdAt: { gte: start, lte: end },
                    address: { project: { clientCompanyId: clientId } } 
                },
                include: { address: true, items: { include: { priceItem: true } } }
            })
        ]);

        res.json({ activations, soplados, fusions, installations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error cargando trabajos pendientes' });
    }
};

exports.createInvoice = async (req, res) => {
    const { clientId, date, dueDate, itemIds } = req.body;
    try {
        const client = await prisma.clientCompany.findUnique({ 
            where: { id: clientId },
            include: { priceItems: true }
        });
        const company = await prisma.companySettings.findFirst();

        if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });

        // 1. Obtener los registros de base de datos
        const activations = await prisma.activationInfo.findMany({ where: { id: { in: itemIds.activations || [] } }, include: { address: true } });
        const soplados = await prisma.sopladoInfo.findMany({ where: { id: { in: itemIds.soplados || [] } }, include: { address: true } });
        const fusions = await prisma.fusionWork.findMany({ where: { id: { in: itemIds.fusions || [] } } });
        const installations = await prisma.simpleInstallation.findMany({ where: { id: { in: itemIds.installations || [] } }, include: { address: true, items: { include: { priceItem: true } } } });

        // 2. Calcular Subtotal y Detalle
        let subtotal = 0;
        const invoiceItems = [];

        // Procesar Activaciones (Lógica de Precios Exactos de Producción)
        activations.forEach(a => {
            const basePrice = a.basePrice || 0;
            const fullAddress = `${a.address.street} ${a.address.number || ''}`.trim();
            invoiceItems.push({ desc: `Activación: ${fullAddress} (${a.activationType || 'Normal'})`, qty: 1, price: basePrice, total: basePrice });
            subtotal += basePrice;
            
            // Añadir TA si tiene precio o cuenta (Usamos el precio guardado en BD)
            if ((a.taInstalled && a.taCount > 0) || (a.taPrice && a.taPrice > 0)) {
                const taPrice = a.taPrice || 0;
                const count = a.taCount || 1;
                invoiceItems.push({ desc: `Equipos TA/SDU instalados (${fullAddress})`, qty: count, price: taPrice / count, total: taPrice });
                subtotal += taPrice;
            }
 
            // Añadir SP si tiene precio
            if (a.spPrice && a.spPrice > 0) {
                invoiceItems.push({ desc: `Equipos SP instalados (${fullAddress})`, qty: a.spInstalled || 1, price: a.spPrice / (a.spInstalled || 1), total: a.spPrice });
                subtotal += a.spPrice;
            }
 
            // Añadir MDU si tiene precio
            if (a.mduPrice && a.mduPrice > 0) {
                invoiceItems.push({ desc: `Equipo MDU instalado (${fullAddress})`, qty: 1, price: a.mduPrice, total: a.mduPrice });
                subtotal += a.mduPrice;
            }
 
            // Añadir Reparación si tiene precio
            if (a.repairPrice && a.repairPrice > 0) {
                invoiceItems.push({ desc: `Reparación realizada (${fullAddress})`, qty: 1, price: a.repairPrice, total: a.repairPrice });
                subtotal += a.repairPrice;
            }
        });
 
        // Procesar Soplados
        soplados.forEach(s => {
            const pricePerMeter = 0.40; 
            const total = s.meters * pricePerMeter;
            const fullAddress = `${s.address.street} ${s.address.number || ''}`.trim();
            invoiceItems.push({ desc: `Soplado fibra: ${fullAddress} (${s.meters} m)`, qty: s.meters, price: pricePerMeter, total });
            subtotal += total;
        });

        const vatAmount = subtotal * (client.defaultVat / 100);
        const total = subtotal + vatAmount;

        // 3. Generar número de factura (ES-YYYY-XXX o DE-YYYY-XXX)
        const year = new Date().getFullYear();
        const count = await prisma.invoice.count({
            where: { number: { startsWith: `${company.country || 'ES'}-${year}` } }
        });
        const prefix = (company.country || 'ES').toUpperCase();
        const invoiceNumber = `${prefix}-${year}-${(count + 1).toString().padStart(3, '0')}`;

        // 4. Guardar Factura en DB
        const invoice = await prisma.invoice.create({
            data: {
                number: invoiceNumber,
                clientId,
                date: new Date(date),
                dueDate: dueDate ? new Date(dueDate) : null,
                subtotal,
                vatAmount,
                total,
                items: invoiceItems,
                status: 'PENDING'
            }
        });

        // 5. Generar PDF Físico
        const pdfPath = await generatePdfFile(invoice, client, company);
        await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath } });

        // 6. Vincular trabajos realizados a esta factura
        await Promise.all([
            prisma.activationInfo.updateMany({ where: { id: { in: itemIds.activations || [] } }, data: { invoiceId: invoice.id } }),
            prisma.sopladoInfo.updateMany({ where: { id: { in: itemIds.soplados || [] } }, data: { invoiceId: invoice.id } }),
            prisma.fusionWork.updateMany({ where: { id: { in: itemIds.fusions || [] } }, data: { invoiceId: invoice.id } }),
            prisma.simpleInstallation.updateMany({ where: { id: { in: itemIds.installations || [] } }, data: { invoiceId: invoice.id } })
        ]);

        res.json({ success: true, invoice: { ...invoice, pdfPath } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generando factura' });
    }
};

exports.getInvoices = async (req, res) => {
    try {
        const invoices = await prisma.invoice.findMany({
            include: { client: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando facturas' });
    }
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const updated = await prisma.invoice.update({
            where: { id },
            data: { status }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando estado' });
    }
};

exports.deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Liberar todos los items vinculados
        await prisma.activationInfo.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
        await prisma.sopladoInfo.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
        await prisma.fusionWork.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
        await prisma.simpleInstallation.updateMany({ where: { id: { in: [] }, invoiceId: id }, data: { invoiceId: null } }); // Caso genérico

        // 2. Borrar la factura física (el registro en DB)
        await prisma.invoice.delete({ where: { id } });

        res.json({ message: 'Factura eliminada y producción liberada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando factura' });
    }
};

exports.regeneratePdf = async (req, res) => {
    const { id } = req.params;
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' });

        const client = await prisma.clientCompany.findUnique({ where: { id: invoice.clientId } });
        const company = await prisma.companySettings.findFirst();

        const pdfPath = await generatePdfFile(invoice, client, company);
        await prisma.invoice.update({ where: { id }, data: { pdfPath } });

        res.json({ success: true, pdfPath: `${pdfPath}?t=${Date.now()}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error regenerando PDF' });
    }
};

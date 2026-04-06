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
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // 1. Cabecera (Logo y Datos Joa)
        const logoPath = path.join(__dirname, '../../uploads/logo_factura.png'); // Guardaremos el logo aquí
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 450, 45, { width: 100 });
        }

        doc.fillColor('#444444').fontSize(20).text(company.name, 50, 50);
        doc.fontSize(10).text(company.address || '', 50, 80);
        doc.text(`${company.taxId || ''}`, 50, 95);
        doc.text(`${company.email || ''} | ${company.phone || ''}`, 50, 110);
        doc.moveDown();

        // 2. Datos del Cliente (A la derecha)
        doc.fillColor('#000000').fontSize(12).text('FACTURAR A:', 50, 160);
        doc.fontSize(14).text(client.legalName || client.name, 50, 180);
        doc.fontSize(10).text(client.address || '', 50, 200);
        doc.text(`${client.city || ''}, ${client.postalCode || ''}, ${client.country || ''}`, 50, 215);
        doc.text(`CIF/VAT: ${client.taxId || ''}`, 50, 230);

        // Info Factura (A la izquierda)
        doc.text(`Nº Factura: ${invoice.number}`, 400, 180);
        doc.text(`Fecha: ${new Date(invoice.date).toLocaleDateString('es-ES')}`, 400, 195);
        doc.text(`Vencimiento: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-ES') : '-'}`, 400, 210);

        doc.moveDown();
        
        // 3. Tabla de Items
        const tableTop = 300;
        doc.font('Helvetica-Bold');
        doc.text('Concepto', 50, tableTop);
        doc.text('Cant.', 300, tableTop, { width: 50, align: 'right' });
        doc.text('Precio', 370, tableTop, { width: 70, align: 'right' });
        doc.text('Total', 460, tableTop, { width: 80, align: 'right' });
        
        doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
        doc.font('Helvetica');

        let position = tableTop + 40;
        invoice.items.forEach(item => {
            doc.text(item.desc, 50, position, { width: 240 });
            doc.text(item.qty.toString(), 300, position, { width: 50, align: 'right' });
            doc.text(money(item.price), 370, position, { width: 70, align: 'right' });
            doc.text(money(item.total), 460, position, { width: 80, align: 'right' });
            position += 25;
        });

        doc.moveTo(50, position + 10).lineTo(550, position + 10).stroke();

        // 4. Totales
        const totalPosition = position + 30;
        doc.text('Subtotal:', 370, totalPosition, { width: 70, align: 'right' });
        doc.text(money(invoice.subtotal), 460, totalPosition, { width: 80, align: 'right' });

        doc.text(`IVA (${client.defaultVat}%):`, 370, totalPosition + 20, { width: 70, align: 'right' });
        doc.text(money(invoice.vatAmount), 460, totalPosition + 20, { width: 80, align: 'right' });

        doc.font('Helvetica-Bold').fontSize(14);
        doc.text('TOTAL:', 370, totalPosition + 50, { width: 70, align: 'right' });
        doc.text(money(invoice.total), 460, totalPosition + 50, { width: 80, align: 'right' });

        // 5. Pie de página (Datos Bancarios)
        doc.fontSize(10).font('Helvetica').fillColor('#888888');
        doc.text(`Forma de pago: Transferencia Bancaria`, 50, 700);
        doc.text(`Datos de cuenta (IBAN): ${company.bankDetails || 'Pendiente'}`, 50, 715);
        doc.text('Muchas gracias por su confianza.', 50, 740, { align: 'center' });

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

        // Procesar Activaciones (Lógica de Precios)
        activations.forEach(a => {
            const basePrice = a.basePrice || 250; // Fallback o usar tarifario
            invoiceItems.push({ desc: `Activación: ${a.address.street} (${a.activationType})`, qty: 1, price: basePrice, total: basePrice });
            subtotal += basePrice;
            
            if (a.taInstalled && a.taCount > 0) {
                const taPrice = 50; 
                invoiceItems.push({ desc: `Equipos TA instalados (${a.taCount})`, qty: a.taCount, price: taPrice, total: taPrice * a.taCount });
                subtotal += (taPrice * a.taCount);
            }
        });

        // Procesar Soplados
        soplados.forEach(s => {
            const pricePerMeter = 0.40; // Deberíamos buscarlo en client.priceItems
            const total = s.meters * pricePerMeter;
            invoiceItems.push({ desc: `Soplado fibra: ${s.address.street} (${s.meters} m)`, qty: s.meters, price: pricePerMeter, total });
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

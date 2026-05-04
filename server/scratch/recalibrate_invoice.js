const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const money = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);

async function recalibrateInvoice() {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { number: 'ES-2026-001' },
            include: { 
                activations: { include: { address: true } },
                soplados: { include: { address: true } },
                installations: { include: { address: true, items: { include: { priceItem: true } } } },
                fusions: true
            }
        });

        if (!invoice) {
            console.log('Invoice not found');
            return;
        }

        const invoiceItems = [];
        
        // Re-generate Activations
        invoice.activations.forEach(a => {
            const basePrice = a.basePrice || 0;
            const fullAddress = `${a.address.street} ${a.address.number || ''}`.trim();
            invoiceItems.push({ desc: `Activación: ${fullAddress} (${a.activationType || 'Normal'})`, qty: 1, price: basePrice, total: basePrice });
            
            if ((a.taInstalled && a.taCount > 0) || (a.taPrice && a.taPrice > 0)) {
                const taPrice = a.taPrice || 0;
                const count = a.taCount || 1;
                invoiceItems.push({ desc: `Equipos TA/SDU instalados (${fullAddress})`, qty: count, price: taPrice / count, total: taPrice });
            }
            if (a.spPrice && a.spPrice > 0) {
                invoiceItems.push({ desc: `Equipos SP instalados (${fullAddress})`, qty: a.spInstalled || 1, price: a.spPrice / (a.spInstalled || 1), total: a.spPrice });
            }
            if (a.mduPrice && a.mduPrice > 0) {
                invoiceItems.push({ desc: `Equipo MDU instalado (${fullAddress})`, qty: 1, price: a.mduPrice, total: a.mduPrice });
            }
            if (a.repairPrice && a.repairPrice > 0) {
                invoiceItems.push({ desc: `Reparación realizada (${fullAddress})`, qty: 1, price: a.repairPrice, total: a.repairPrice });
            }
        });

        // Re-generate Soplados
        invoice.soplados.forEach(s => {
            const pricePerMeter = 0.40;
            const total = s.meters * pricePerMeter;
            const fullAddress = `${s.address.street} ${s.address.number || ''}`.trim();
            invoiceItems.push({ desc: `Soplado fibra: ${fullAddress} (${s.meters} m)`, qty: s.meters, price: pricePerMeter, total });
        });

        // Update DB
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { items: invoiceItems }
        });

        console.log('Invoice items recalibrated successfully');
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

recalibrateInvoice();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixInvoice() {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { number: 'ES-2026-001' },
            include: { 
                activations: { include: { address: true } },
                soplados: { include: { address: true } }
            }
        });

        if (!invoice) {
            console.log('Invoice not found');
            return;
        }

        const newItems = [];
        
        // Fix Activations
        invoice.activations.forEach(a => {
            const fullAddress = `${a.address.street} ${a.address.number || ''}`.trim();
            const itemsForThisAct = (invoice.items || []).filter(item => 
                item.desc.includes(a.address.street) && 
                (item.desc.includes('Activación') || item.desc.includes('TA/SDU') || item.desc.includes('SP') || item.desc.includes('MDU') || item.desc.includes('Reparación'))
            );

            itemsForThisAct.forEach(item => {
                item.desc = item.desc.replace(a.address.street, fullAddress);
            });
        });

        // Fix Soplados
        invoice.soplados.forEach(s => {
            const fullAddress = `${s.address.street} ${s.address.number || ''}`.trim();
            const itemsForThisSoplado = (invoice.items || []).filter(item => 
                item.desc.includes(s.address.street) && item.desc.includes('Soplado')
            );

            itemsForThisSoplado.forEach(item => {
                item.desc = item.desc.replace(s.address.street, fullAddress);
            });
        });

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { items: invoice.items }
        });

        console.log('Invoice items updated successfully');
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

fixInvoice();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.address.count();
    const cerrada = await prisma.address.count({ where: { orderStatus: 'CERRADA' } });
    const derivada = await prisma.address.count({ where: { orderStatus: 'DERIVADA' } });
    
    console.log(`TOTAL ADDRESSES: ${total}`);
    console.log(`CERRADA: ${cerrada}`);
    console.log(`DERIVADA: ${derivada}`);
    
    // Check oldest CERRADA date
    const oldest = await prisma.address.findFirst({
        where: { orderStatus: 'CERRADA' },
        orderBy: { updatedAt: 'asc' }
    });
    if (oldest) console.log(`OLDEST CERRADA UPDATED AT: ${oldest.updatedAt}`);
}

main().finally(() => prisma.$disconnect());

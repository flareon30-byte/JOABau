const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const acts = await prisma.activationInfo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { address: true }
  });

  console.log('--- Resumen de últimas 10 activaciones ---');
  acts.forEach(a => {
    const gross = (a.basePrice || 0) + (a.taPrice || 0) + (a.spPrice || 0) + (a.mduPrice || 0) + (a.repairPrice || 0);
    console.log(`ID: ${a.id} | Calle: ${a.address.street} | Tipo: ${a.activationType}`);
    console.log(`   Base: ${a.basePrice} | TA: ${a.taPrice} | SP: ${a.spPrice} | MDU: ${a.mduPrice} | REPAIR: ${a.repairPrice}`);
    console.log(`   TOTAL LINEA: ${gross}€`);
    console.log('-----------------------------------------');
  });

  await prisma.$disconnect();
}

debug();

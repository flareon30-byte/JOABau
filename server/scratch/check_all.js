const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
  const acts = await prisma.activationInfo.findMany({
    include: { address: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log(`Encontradas las últimas ${acts.length} activaciones.`);

  acts.forEach(a => {
    console.log(`- ${a.id}: ${a.address.street} ${a.address.number || ''} | Fecha DB: ${a.createdAt.toISOString()}`);
    console.log(`  Base: ${a.basePrice} | TA: ${a.taPrice} | SP: ${a.spPrice} | MDU: ${a.mduPrice}`);
    console.log(`  TOTAL: ${(a.basePrice||0) + (a.taPrice||0) + (a.spPrice||0) + (a.mduPrice||0)}€`);
    console.log('---');
  });

  await prisma.$disconnect();
}

checkAll();

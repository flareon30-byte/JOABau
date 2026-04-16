const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const acts = await prisma.activationInfo.findMany({
    include: { address: true }
  });

  const today = acts.filter(a => a.createdAt.toISOString().startsWith('2026-04-10'));
  console.log(`Hoy se han hecho ${today.length} activaciones.`);

  today.forEach(a => {
    console.log(`- ${a.id}: ${a.address.street} ${a.address.number || ''}`);
    console.log(`  Base: ${a.basePrice} | TA: ${a.taPrice} | SP: ${a.spPrice} | MDU: ${a.mduPrice}`);
    console.log(`  TOTAL: ${(a.basePrice||0) + (a.taPrice||0) + (a.spPrice||0) + (a.mduPrice||0)}€`);
    console.log('---');
  });

  await prisma.$disconnect();
}

check();

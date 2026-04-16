const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('--- Iniciando corrección de facturación ---');
  
  // Buscamos activaciones con mduPrice de 48 euros
  const faulty = await prisma.activationInfo.findMany({
    where: { mduPrice: 48 }
  });

  console.log(`Encontradas ${faulty.length} activaciones con recargo de 48€.`);

  for (const act of faulty) {
    console.log(`Corrigiendo activación ID: ${act.id}...`);
    await prisma.activationInfo.update({
      where: { id: act.id },
      data: {
        mduPrice: 0,
        // No tocamos totalAmount porque se calcula dinámicamente en el export o se usa el campo si existe
      }
    });
  }

  console.log('--- Corrección finalizada ---');
  await prisma.$disconnect();
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});

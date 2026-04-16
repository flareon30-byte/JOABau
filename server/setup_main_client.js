const { PrismaClient, Department } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Configuración Maestra de Facturación ---');

  // 1. Crear el Cliente Principal (Si no existe)
  const client = await prisma.clientCompany.upsert({
    where: { name: 'CLIENTE PRINCIPAL' },
    update: {},
    create: {
      name: 'CLIENTE PRINCIPAL',
      taxId: 'CIF-CLIENTE-PENDIENTE',
      address: 'Dirección del Cliente, Ciudad, España',
      country: 'ES',
      defaultVat: 21.0
    }
  });
  console.log('✅ Cliente PRINCIPAL creado/verificado');

  // 2. Cargar sus Precios Base (Sacados de SystemSettings)
  const prices = [
    { name: 'Activación Estándar', department: 'ACTIVATION', priceToClient: 250, bonusToTeam: 20 },
    { name: 'Instalación SP', department: 'ACTIVATION', priceToClient: 75, bonusToTeam: 0 },
    { name: 'Instalación TA', department: 'ACTIVATION', priceToClient: 50, bonusToTeam: 10 },
    { name: 'Instalación MDU', department: 'ACTIVATION', priceToClient: 50, bonusToTeam: 10 },
    { name: 'Activación Multi-familia', department: 'ACTIVATION', priceToClient: 100, bonusToTeam: 10 },
    { name: 'Soplado (por metro)', department: 'BLOWING', priceToClient: 0.4, bonusToTeam: 0.05 },
    { name: 'Cita Concertada', department: 'BACK_OFFICE', priceToClient: 15, bonusToTeam: 0 },
    { name: 'Avería / Reparación', department: 'ACTIVATION', priceToClient: 45, bonusToTeam: 0 }
  ];

  for (const p of prices) {
    await prisma.clientPriceItem.upsert({
      where: { id: `price-${p.name.replace(/\s/g, '-')}` }, // Usar IDs estables para el init
      update: { priceToClient: p.priceToClient, bonusToTeam: p.bonusToTeam },
      create: {
        id: `price-${p.name.replace(/\s/g, '-')}`,
        clientCompanyId: client.id,
        name: p.name,
        department: p.department,
        priceToClient: p.priceToClient,
        bonusToTeam: p.bonusToTeam
      }
    });
  }
  console.log('✅ Tarifario del cliente actualizado con precios actuales');

  // 3. Vincular TODO lo que esté suelto al nuevo cliente
  console.log('🔗 Vinculando proyectos...');
  await prisma.project.updateMany({
    where: { clientCompanyId: null },
    data: { clientCompanyId: client.id }
  });

  console.log('🔗 Vinculando equipos...');
  await prisma.team.updateMany({
    where: { activeClientCompanyId: null },
    data: { activeClientCompanyId: client.id }
  });

  console.log('🔗 Vinculando usuarios...');
  await prisma.user.updateMany({
    where: { activeClientCompanyId: null },
    data: { activeClientCompanyId: client.id }
  });

  console.log('--- ✨ Sistema Listo para Facturar ---');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

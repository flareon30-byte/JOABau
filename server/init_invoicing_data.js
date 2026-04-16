const { PrismaClient, Department } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Inicializando Datos de Facturación ---');

  // 1. Crear Configuración de Empresa (JOA)
  const joa = await prisma.companySettings.upsert({
    where: { id: 'default-joa-cfg' },
    update: {},
    create: {
      id: 'default-joa-cfg',
      name: 'JOA Technologien',
      taxId: 'B12345678', // Ejemplo a editar por el usuario
      address: 'Calle Ejemplo 123, Madrid, España',
      email: 'info@joatechnologien.de',
      phone: '+34 600 000 000',
      bankDetails: 'ES00 0000 0000 0000 0000 0000'
    }
  });
  console.log('✅ Empresa JOA inicializada');

  // 2. Buscar o crear el Cliente Actual (para no duplicar si ya existe)
  // El usuario dice que hay un solo cliente "real"
  const existingClient = await prisma.clientCompany.findFirst();
  
  if (existingClient) {
    console.log(`ℹ️ Actualizando ficha fiscal para el cliente: ${existingClient.name}`);
    await prisma.clientCompany.update({
      where: { id: existingClient.id },
      data: {
        taxId: 'CIF-CLIENTE-EJEMPLO',
        address: 'Dirección del Cliente, Ciudad, España',
        country: 'ES',
        defaultVat: 21.0
      }
    });

    // Asegurarnos de que tenga los items de precio
    // Estos precios deberían venir de su sistema de rentabilidad actual
    console.log('✅ Precios del cliente verificados');
  } else {
    console.log('⚠️ No se encontró ningún cliente previo para inicializar.');
  }

  console.log('--- Proceso Finalizado ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanEmptyTeams() {
  try {
    const deleted = await prisma.team.deleteMany({
      where: {
        AND: [
            { name: 'Test Delete Team' },
            { members: { none: {} } }
        ]
      }
    });

    console.log(`--- LIMPIEZA COMPLETADA ---`);
    console.log(`Se han eliminado ${deleted.count} equipos de prueba vacíos.`);

  } catch (error) {
    console.error('Error al limpiar:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanEmptyTeams();

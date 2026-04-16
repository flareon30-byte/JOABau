const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteGhostTeam() {
  const targetName = 'Alex-David';
  try {
    const teams = await prisma.team.findMany({
      where: { name: targetName }
    });

    if (teams.length === 0) {
      console.log(`No se encontró ningún equipo con el nombre "${targetName}".`);
      return;
    }

    console.log(`Encontrados ${teams.length} equipos con el nombre "${targetName}". Procediendo a borrar...`);

    for (const team of teams) {
        // Disconnect users first to avoid foreign key issues
        await prisma.user.updateMany({
            where: { teamId: team.id },
            data: { teamId: null }
        });
        
        await prisma.team.delete({ where: { id: team.id } });
        console.log(`Equipo con ID ${team.id} eliminado correctamente.`);
    }

    console.log('--- OPERACIÓN COMPLETADA ---');

  } catch (error) {
    console.error('Error durante la eliminación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteGhostTeam();

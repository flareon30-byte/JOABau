const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTeams() {
  try {
    const allTeams = await prisma.team.findMany({
      include: {
        members: true,
        vehicle: true
      }
    });

    console.log('--- LISTADO COMPLETO DE EQUIPOS (REALES Y DEMO) ---');
    allTeams.forEach(t => {
      console.log(`ID: ${t.id} | Nombre: ${t.name} | Demo: ${t.isDemo} | Vehículo: ${t.vehicle ? t.vehicle.plate : 'NINGUNO'}`);
      console.log(`Miembros: ${t.members.map(m => m.username).join(', ')}`);
      console.log('--------------------------------------------------');
    });

    if (allTeams.length === 0) console.log('No hay ningún equipo en la base de datos.');

  } catch (error) {
    console.error('Error al consultar equipos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeams();

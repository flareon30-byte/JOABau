const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVehicles() {
  try {
    const allVehicles = await prisma.vehicle.findMany({
      include: {
        team: true
      }
    });

    console.log('--- ESTADO DE VEHÍCULOS ---');
    allVehicles.forEach(v => {
      console.log(`Coche: ${v.make} ${v.model} | Matrícula: ${v.plate} | Equipo Actual: ${v.team ? v.team.name : 'LIBRE'}`);
    });

    if (allVehicles.length === 0) console.log('No hay vehículos registrados.');

  } catch (error) {
    console.error('Error al consultar vehículos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicles();

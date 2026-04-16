const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { in: ['Alex Wildman', 'David Espinosa'] }
      },
      select: {
          id: true,
          username: true,
          teamId: true,
          team: { select: { name: true } }
      }
    });

    console.log('--- ESTADO DE USUARIOS SELECCIONADOS ---');
    users.forEach(u => {
      console.log(`Usuario: ${u.username} | Equipo ID: ${u.teamId || 'NINGUNO'} | Nombre Equipo: ${u.team ? u.team.name : 'LIBRE'}`);
    });

    if (users.length === 0) console.log('No se encontraron esos usuarios con esos nombres exactos.');

  } catch (error) {
    console.error('Error al consultar usuarios:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllOccupied() {
  try {
    const teams = await prisma.team.findMany({
      include: { members: true }
    });

    console.log('--- EQUIPOS REALES EN DB ---');
    teams.forEach(t => {
      console.log(`Equipo: ${t.name} (ID: ${t.id}) | Miembros: ${t.members.map(m => m.username).join(', ')}`);
    });

    const orphanUsers = await prisma.user.findMany({
        where: { teamId: { not: null } },
        include: { team: true }
    });
    
    console.log('\n--- USUARIOS CON TEAM_ID ASIGNADO ---');
    orphanUsers.forEach(u => {
        if (!u.team) {
            console.log(`¡ALERTA! Usuario ${u.username} tiene teamId ${u.teamId} pero el EQUIPO NO EXISTE.`);
        } else {
            console.log(`Usuario: ${u.username} -> Equipo: ${u.team.name}`);
        }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllOccupied();

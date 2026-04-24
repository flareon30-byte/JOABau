const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTeams() {
    try {
        const teams = await prisma.team.findMany({
            include: {
                appointments: {
                    where: { status: 'COMPLETADO' },
                    orderBy: { updatedAt: 'desc' },
                    take: 5,
                    include: { address: true }
                }
            }
        });
        console.log(JSON.stringify(teams, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkTeams();

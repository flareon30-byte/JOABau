const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Ultimas 10 notificaciones ---');
    const notifs = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log(JSON.stringify(notifs, null, 2));

    console.log('--- Ultimas solicitudes de vacaciones ---');
    const vacations = await prisma.vacationRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: true }
    });
    console.log(JSON.stringify(vacations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

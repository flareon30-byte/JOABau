const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            vacationDaysTotal: true
        }
    });
    console.log('--- Users Data ---');
    console.table(users);
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

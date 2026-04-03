const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function restore() {
    try {
        const janePass = await bcrypt.hash('2122000', 10);
        const techPass = await bcrypt.hash('123456', 10);

        // 1. Restaurar Jane Orden (Super Admin)
        await prisma.user.upsert({
            where: { username: 'Jane Orden' },
            update: { password: janePass, role: 'SUPER_ADMIN' },
            create: {
                username: 'Jane Orden',
                password: janePass,
                role: 'SUPER_ADMIN',
                baseSalary: 2500
            }
        });

        // 2. Restaurar Alex Wildman (Tecnico)
        await prisma.user.upsert({
            where: { username: 'Alex Wildman' },
            update: { password: techPass, role: 'ACTIVATOR' },
            create: {
                username: 'Alex Wildman',
                password: techPass,
                role: 'ACTIVATOR',
                baseSalary: 1600
            }
        });

        console.log('RESULT_STATUS: JOA_RESTORE_OK');
        console.log('JANE_ORDEN: RESTORED');
        console.log('ALEX_WILDMAN: RESTORED');

    } catch (e) {
        console.error('RESULT_ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
restore();

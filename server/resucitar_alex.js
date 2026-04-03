const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    try {
        const pass = await bcrypt.hash('000000', 10);
        await prisma.user.upsert({
            where: { username: 'Alex Wildman' },
            update: { password: pass },
            create: {
                username: 'Alex Wildman',
                password: pass,
                role: 'ACTIVATOR',
                baseSalary: 1600.0,
                isDemo: true
            }
        });
        console.log('RESULT_STATUS: ALEX_RESURRECTED_OK');
    } catch (e) {
        console.error('RESULT_ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

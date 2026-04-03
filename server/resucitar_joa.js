const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    try {
        const janePass = await bcrypt.hash('2122000', 10);
        const techPass = await bcrypt.hash('123456', 10);

        const users = [
            { username: 'Jane Orden', password: janePass, role: 'SUPER_ADMIN' },
            { username: 'Alex Wildman', password: techPass, role: 'ACTIVATOR' },
            { username: 'Alvaro', password: techPass, role: 'ACTIVATOR' },
            { username: 'David', password: techPass, role: 'ACTIVATOR' },
            { username: 'Erick', password: techPass, role: 'ACTIVATOR' },
            { username: 'Damaris', password: techPass, role: 'ACTIVATOR' }
        ];

        for (const u of users) {
             await prisma.user.upsert({
                where: { username: u.username },
                update: { password: u.password, role: u.role },
                create: {
                    username: u.username,
                    password: u.password,
                    role: u.role,
                    baseSalary: 1600.0,
                    isDemo: false
                }
            });
        }
        console.log('RESULT_STATUS: JOA_TEAM_RESURRECTED_OK');
        console.log('JANE_ORDEN: READY');
        console.log('ALVARO_DAVID_ERICK_DAMARIS_ALEX: READY');

    } catch (e) {
        console.error('RESULT_ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    try {
        const pass = await bcrypt.hash('123456', 10);
        await prisma.user.upsert({
            where: { username: 'admin_joa' },
            update: { password: pass, role: 'SUPER_ADMIN' },
            create: {
                username: 'admin_joa',
                password: pass,
                role: 'SUPER_ADMIN',
                baseSalary: 0
            }
        });
        console.log('RESULT: EMERGENCY_ADMIN_CREATED');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

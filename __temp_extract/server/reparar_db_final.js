const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function repair() {
    try {
        console.log('Verificando base de datos...');
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

        const users = await prisma.user.findMany({ select: { username: true } });
        console.log('Usuarios en DB:', users.map(u => u.username).join(', '));
        console.log('REPARACION_COMPLETA');
    } catch (e) {
        console.error('ERROR_REPARACION:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
repair();

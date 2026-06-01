const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdmin() {
    const username = 'admin';
    const password = 'admin123'; // Default password

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            await prisma.user.update({
                where: { username },
                data: {
                    password: hashedPassword,
                    role: 'SUPER_ADMIN'
                }
            });
            console.log(`[OK] El usuario '${username}' ya existía. Se ha restablecido la contraseña a '${password}' y el rol a SUPER_ADMIN.`);
        } else {
            await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: 'SUPER_ADMIN'
                }
            });
            console.log(`[OK] Usuario '${username}' creado con la contraseña '${password}' y rol SUPER_ADMIN.`);
        }
    } catch (e) {
        console.error('[ERROR] No se pudo crear/actualizar el administrador:', e);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();

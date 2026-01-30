
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdmin() {
    const username = 'Jane Orden';
    const password = 'password123'; // Temporary password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Resetting password for ${username}...`);

    try {
        const user = await prisma.user.upsert({
            where: { username },
            update: {
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                isDemo: false
            },
            create: {
                username,
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                isDemo: false
            }
        });

        console.log(`User ${user.username} updated. New password: ${password}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdmin();

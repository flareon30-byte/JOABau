const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const username = 'jane.orden.hidalgo@gmail.com';
    const password = '2122000';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.upsert({
            where: { username },
            update: { password: hashedPassword, role: 'SUPER_ADMIN' },
            create: {
                username,
                password: hashedPassword,
                role: 'SUPER_ADMIN'
            }
        });
        console.log(`User ${user.username} updated/created with password ${password}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

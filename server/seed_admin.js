const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('--- Seeding Default Admin ---');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    try {
        const admin = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                baseSalary: 3200
            }
        });
        console.log('✓ Admin User Created: admin / admin123');
    } catch (e) {
        console.error('Error creating admin:', e);
    }
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

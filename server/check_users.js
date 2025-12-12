const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking for users...');
        const users = await prisma.user.findMany();
        console.log('User count:', users.length);
        users.forEach(u => console.log(`- ${u.username} (${u.role})`));

        if (users.length === 0) {
            console.log('No users found. Database might be empty.');
        }
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();


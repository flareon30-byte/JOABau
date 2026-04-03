const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({
            select: { username: true, role: true }
        });
        console.log('--- USERS IN JOA ---');
        users.forEach(u => console.log(`[${u.role}] ${u.username}`));
        console.log('--- END LIST ---');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

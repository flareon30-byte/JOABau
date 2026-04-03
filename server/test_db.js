const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Test 1: Can we read from DB?
        const u = await prisma.user.findFirst({ where: { username: 'Alex Wildman' } });
        console.log('RESULT_CHECK_USER:', u ? 'FOUND' : 'NOT_FOUND');
        if (u) {
            console.log('RESULT_ROLE:', u.role);
        }
    } catch (e) {
        console.error('RESULT_ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

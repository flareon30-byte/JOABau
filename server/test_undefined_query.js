const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const user = await prisma.user.findUnique({
            where: { id: undefined },
            select: { username: true }
        });
        console.log("USER query with undefined id succeeded:", user);
    } catch (e) {
        console.error("Prisma error querying user with undefined id:", e.message);
    }
    await prisma.$disconnect();
}
run();

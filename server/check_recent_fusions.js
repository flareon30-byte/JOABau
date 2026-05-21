const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const works = await prisma.fusionWork.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });
        console.log("RECENT FUSION WORKS:");
        console.log(JSON.stringify(works, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

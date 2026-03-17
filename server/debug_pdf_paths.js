const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const acts = await prisma.activationInfo.findMany({
        take: 10,
        select: {
            id: true,
            pdfPath: true,
            address: {
                select: {
                    street: true,
                    number: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
    console.log(JSON.stringify(acts, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

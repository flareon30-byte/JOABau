const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Current Projects ---');
    const projects = await prisma.project.findMany({
        include: {
            _count: {
                select: { addresses: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    
    projects.forEach(p => {
        console.log(`ID: ${p.id} | Name: "${p.name}" | Addresses: ${p._count.addresses}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

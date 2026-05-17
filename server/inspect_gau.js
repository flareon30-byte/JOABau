const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Inspecting Gau-Bickelheim Project ---');
    const project = await prisma.project.findFirst({
        where: { name: { contains: 'Gau-Bickelheim', mode: 'insensitive' } },
        include: {
            addresses: {
                take: 10
            }
        }
    });

    if (!project) {
        console.log('Project "Gau-Bickelheim" not found by name. Let\'s find the project with 530 addresses!');
        const allProjects = await prisma.project.findMany({
            include: {
                _count: { select: { addresses: true } }
            }
        });
        for (const p of allProjects) {
            console.log(`- Project "${p.name}" has ${p._count.addresses} addresses`);
        }
        
        // Find the one with most addresses
        const biggest = allProjects.reduce((max, p) => p._count.addresses > max._count.addresses ? p : max, allProjects[0]);
        if (biggest && biggest._count.addresses > 0) {
            console.log(`\nInspecting biggest project: "${biggest.name}" (ID: ${biggest.id})`);
            const details = await prisma.project.findUnique({
                where: { id: biggest.id },
                include: { addresses: { take: 10 } }
            });
            printAddresses(details.addresses);
        }
    } else {
        console.log(`Found Project: "${project.name}" (ID: ${project.id})`);
        printAddresses(project.addresses);
    }
}

function printAddresses(addresses) {
    console.log(`Total addresses fetched for inspection: ${addresses.length}`);
    addresses.forEach((addr, i) => {
        console.log(`[${i}] Street: "${addr.street}" | Number: "${addr.number}" | City: "${addr.city}" | NVT: "${addr.nvt}" | ClientName: "${addr.clientName}"`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

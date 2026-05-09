const prisma = require('./src/prisma');

async function debug() {
    try {
        const count = await prisma.activationInfo.count();
        console.log('--- DB DIAGNOSTICS ---');
        console.log('TOTAL ACTIVATIONS:', count);

        const recent = await prisma.activationInfo.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });
        
        console.log('\nLATEST 5 ACTIVATIONS:');
        recent.forEach(r => {
            console.log(`ID: ${r.id} | CreatedAt: ${r.createdAt} | UpdatedAt: ${r.updatedAt}`);
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

debug();

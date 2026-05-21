const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'FusionWork'
        `;
        console.log("COLUMNS OF FusionWork:", JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error("Error querying table info:", e);
    }
    await prisma.$disconnect();
}
run();

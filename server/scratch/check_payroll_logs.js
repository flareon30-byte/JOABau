const prisma = require('../src/prisma');

async function main() {
    const logs = await prisma.payrollLog.findMany({
        include: { user: true }
    });
    console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

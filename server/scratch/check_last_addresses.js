const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.address.count();
  const last = await prisma.address.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { street: true, number: true, createdAt: true }
  });
  console.log('Total addresses:', count);
  console.log('Last 5 addresses:', JSON.stringify(last, null, 2));
  process.exit(0);
}

check();

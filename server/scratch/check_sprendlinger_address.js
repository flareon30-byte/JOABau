const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const addresses = await prisma.address.findMany({
    where: {
      street: { contains: 'Sprendlinger' }
    }
  });
  console.log('Addresses for Sprendlinger:', JSON.stringify(addresses, null, 2));
  process.exit(0);
}

check();

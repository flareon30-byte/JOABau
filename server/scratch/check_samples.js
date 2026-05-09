const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const addresses = await prisma.address.findMany({
    take: 10,
    select: {
      id: true,
      street: true,
      number: true,
      appointment: {
        select: {
          id: true,
          assignedDate: true,
          status: true
        }
      }
    }
  });
  console.log('Sample addresses:', JSON.stringify(addresses, null, 2));
  process.exit(0);
}

check();

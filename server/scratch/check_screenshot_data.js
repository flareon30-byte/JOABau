const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const addresses = await prisma.address.findMany({
    where: {
      street: { contains: 'Sprendlinger' }
    },
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
  console.log('Found addresses and appointments:', JSON.stringify(addresses, null, 2));
  process.exit(0);
}

check();

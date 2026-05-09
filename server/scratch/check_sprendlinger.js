const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const appointments = await prisma.appointment.findMany({
    where: {
      address: {
        street: { contains: 'Sprendlinger' }
      }
    },
    include: { address: true }
  });
  console.log('Appointments for Sprendlinger:', JSON.stringify(appointments, null, 2));
  process.exit(0);
}

check();

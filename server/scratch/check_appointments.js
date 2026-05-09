const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const appointments = await prisma.appointment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, assignedDate: true, createdAt: true, status: true, address: { select: { street: true } } }
  });
  console.log('Recent appointments:', JSON.stringify(appointments, null, 2));
  process.exit(0);
}

check();

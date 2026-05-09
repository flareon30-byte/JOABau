const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const appointments = await prisma.appointment.findMany({
    where: { assignedDate: null },
    select: { id: true, status: true, type: true, createdAt: true, address: { select: { street: true, number: true } } }
  });
  console.log('Appointments with NULL assignedDate:', JSON.stringify(appointments, null, 2));
  process.exit(0);
}

check();

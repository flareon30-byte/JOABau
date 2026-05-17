const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAddress() {
  try {
    const address = await prisma.address.findFirst({
      where: {
        street: { contains: 'Schulrat-Spang-Str', mode: 'insensitive' },
        number: '11'
      },
      include: {
        activationInfo: {
          include: { createdBy: true }
        },
        appointment: {
          include: { assignedTeam: { include: { members: true } } }
        }
      }
    });

    console.log(JSON.stringify(address, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAddress();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const info = await prisma.activationInfo.findMany({
    include: { address: true }
  });
  const buggy = info.filter(i => i.customActivationName && i.customActivationName.includes('activa vivienda'));
  console.log(JSON.stringify(buggy, null, 2));

  for (const item of buggy) {
    await prisma.activationInfo.update({
        where: { id: item.id },
        data: { customActivationName: null, activationType: 'MDU' }
    });
    console.log('Fixed ' + item.id);
  }
}

main().finally(() => { prisma.$disconnect() });

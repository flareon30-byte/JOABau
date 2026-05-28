const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const info = await prisma.activationInfo.findMany({
    include: { address: true }
  });
  console.log(JSON.stringify(info, null, 2));
}

main().finally(() => { prisma.$disconnect() });

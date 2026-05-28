const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const corrupted = await prisma.activationInfo.findMany({
    where: {
      customActivationName: { not: null },
      description: { not: '' }
    }
  });

  let count = 0;
  for (const info of corrupted) {
    if (info.customActivationName === info.description) {
      await prisma.activationInfo.update({
        where: { id: info.id },
        data: {
          customActivationName: null,
          activationType: 'MDU'
        }
      });
      count++;
      console.log(`Fixed corrupted activation info for addressId ${info.addressId}`);
    }
  }

  console.log(`Finished fixing ${count} corrupted activation infos.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

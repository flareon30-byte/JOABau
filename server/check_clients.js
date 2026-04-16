const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.clientCompany.findMany();
  console.log('--- Listado de Clientes ---');
  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projects = await prisma.project.findMany({
    where: {
      name: { contains: 'Gau' }
    }
  });
  console.log('Projects with Gau:', JSON.stringify(projects, null, 2));
  process.exit(0);
}

check();

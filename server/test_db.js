const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const r = await prisma.clientPriceItem.findMany();
    console.log("PRICE ITEMS:", JSON.stringify(r, null, 2));
    
    const settings = await prisma.systemSettings.findFirst();
    console.log("OLD SETTINGS:", JSON.stringify(settings, null, 2));

    await prisma.$disconnect();
}
run();

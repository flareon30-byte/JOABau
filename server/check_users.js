const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- CHECKING USERS IN DB ---');
        const users = await prisma.user.findMany();
        if (users.length === 0) {
            console.log('NO USERS FOUND! The database is empty.');
        } else {
            console.log(`Found ${users.length} users:`);
            users.forEach(u => {
                console.log(`- Username: ${u.username} | Role: ${u.role} | ID: ${u.id}`);
            });
        }
    } catch (e) {
        console.error('ERROR connecting to DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

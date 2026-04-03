const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    try {
        const username = 'Alex Wildman';
        const user = await prisma.user.findUnique({ where: { username } });
        
        if (!user) {
            console.log('STATUS: USER_NOT_IN_DB');
            return;
        }

        const match = await bcrypt.compare('000000', user.password);
        console.log('STATUS: OK');
        console.log('USER_ID:', user.id);
        console.log('PASSWORD_MATCH:', match ? 'YES' : 'NO');
        console.log('USER_ROLE:', user.role);

    } catch (e) {
        console.error('STATUS: DB_ERROR');
        console.error('MESSAGE:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();

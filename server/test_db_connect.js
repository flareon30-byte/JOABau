const dotenv = require('dotenv');
// Force load .env from current dir
const result = dotenv.config({ path: __dirname + '/.env' });
console.log('Dotenv Result:', result.error ? result.error : 'Success');
console.log('Load DB URL:', process.env.DATABASE_URL ? 'Loaded' : 'Missing');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function testConnection() {
    try {
        await prisma.$connect();
        console.log('SUCCESS: Database Connected!');
        const count = await prisma.user.count();
        console.log('User count:', count);
    } catch (e) {
        console.error('FAILURE: Connection Failed', e);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();

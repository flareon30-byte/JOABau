const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
console.log('Env Path:', envPath);

try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('File content preview:', content.substring(0, 50));
    console.log('File stats:', fs.statSync(envPath).size);
} catch (e) {
    console.error('Error reading .env:', e.message);
}

const result = dotenv.config();
if (result.error) {
    console.error('Dotenv error:', result.error);
}

console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);

// Proceed only if env loaded
if (process.env.DATABASE_URL) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // ... test query ...
    async function run() {
        try {
            const r = await prisma.address.findFirst();
            console.log('DB Connection successful. Found address:', r ? r.id : 'None');
        } catch (e) { console.error('DB Error:', e); }
        finally { await prisma.$disconnect(); }
    }
    run();
}

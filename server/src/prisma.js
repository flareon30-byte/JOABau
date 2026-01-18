const { PrismaClient } = require('@prisma/client');
require('dotenv').config(); // Ensure env vars are loaded even if this file is required directly

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

module.exports = prisma;

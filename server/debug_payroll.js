const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPayroll() {
    // 1. Check Settings
    const settings = await prisma.systemSettings.findFirst();
    console.log('--- System Settings ---');
    console.log('ID:', settings?.id);
    console.log('Financials Type:', typeof settings?.financials);
    console.log('Financials Value:', JSON.stringify(settings?.financials, null, 2));

    // 2. Check User (Super Admin)
    const email = 'jane.orden.hidalgo@gmail.com';
    const user = await prisma.user.findFirst({ where: { username: email } });

    if (!user) {
        console.log('User not found!');
        return;
    }

    console.log('\n--- User Info ---');
    console.log('Role:', user.role);

    // 3. Simulate Logic
    const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
    console.log('Group Key:', groupKey);

    const financialConfig = settings?.financials ? settings.financials[groupKey] : null;
    console.log('Resolved Financial Config:', financialConfig);

    if (!financialConfig) {
        console.error('FAILURE: Financial Config is NULL');
    } else {
        console.log('SUCCESS: Financial Config found');
    }
}

debugPayroll()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

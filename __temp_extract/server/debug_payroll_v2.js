const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function debugPayroll() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };

    try {
        // 1. Check Settings
        const settings = await prisma.systemSettings.findFirst();
        log('--- System Settings ---');
        log('ID: ' + settings?.id);
        log('Financials Type: ' + typeof settings?.financials);
        log('Financials Value: ' + JSON.stringify(settings?.financials, null, 2));

        // 2. Check User (Super Admin)
        // Try partial match if full email fails
        const user = await prisma.user.findFirst({
            where: { username: { contains: 'jane.orden' } }
        });

        if (!user) {
            log('User not found!');
        } else {
            log('\n--- User Info ---');
            log('Username: ' + user.username);
            log('Role: ' + user.role);

            // 3. Simulate Logic
            const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
            log('Group Key: ' + groupKey);

            if (settings?.financials) {
                const financialConfig = settings.financials[groupKey];
                log('Resolved Financial Config: ' + JSON.stringify(financialConfig, null, 2));

                if (!financialConfig) {
                    log('FAILURE: Financial Config is NULL for key ' + groupKey);
                    log('Available keys: ' + Object.keys(settings.financials).join(', '));
                } else {
                    log('SUCCESS: Financial Config found');
                }
            } else {
                log('FAILURE: settings.financials is null/undefined');
            }
        }
    } catch (e) {
        log('ERROR: ' + e.message);
    } finally {
        fs.writeFileSync('debug_result.txt', output);
        await prisma.$disconnect();
    }
}

debugPayroll();

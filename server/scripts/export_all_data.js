const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportAll() {
    console.log('--- Starting Full Data Export ---');
    const folder = path.join(__dirname, '../data_export_' + Date.now());
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const models = [
        'user', 'pushSubscription', 'vacationRequest', 'team', 'tool', 
        'project', 'address', 'sopladoInfo', 'fusionInfo', 'appointment', 
        'comment', 'activationInfo', 'systemSettings', 'notification', 
        'fusionWork', 'repair', 'materialOrder', 'clientCompany', 
        'invoice', 'companySettings', 'clientPriceItem', 'simpleInstallation', 
        'simpleInstallationItem', 'vehicle', 'vehicleLog', 'dietaLog', 'payrollLog'
    ];

    for (const model of models) {
        try {
            console.log(`Exporting ${model}...`);
            const data = await prisma[model].findMany();
            fs.writeFileSync(path.join(folder, `${model}.json`), JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error exporting ${model}:`, error.message);
        }
    }

    console.log(`--- Export Finished! Files saved in: ${folder} ---`);
    console.log('You should copy this folder to the new server for the import phase.');
}

exportAll()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

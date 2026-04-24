const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importAll() {
    const exportFolder = process.argv[2];
    if (!exportFolder) {
        console.error('Please provide the path to the export folder.');
        process.exit(1);
    }

    console.log(`--- Starting Full Data Import from ${exportFolder} ---`);

    // Order matters because of foreign key constraints
    // This is a simplified order.
    const models = [
        'user', 
        'clientCompany', 
        'project', 
        'team', 
        'vehicle',
        'address', 
        'tool', 
        'sopladoInfo', 
        'fusionInfo', 
        'appointment', 
        'comment', 
        'activationInfo', 
        'systemSettings', 
        'notification', 
        'fusionWork', 
        'repair', 
        'materialOrder', 
        'invoice', 
        'companySettings', 
        'clientPriceItem', 
        'simpleInstallation', 
        'simpleInstallationItem', 
        'vehicleLog', 
        'dietaLog', 
        'payrollLog',
        'pushSubscription',
        'vacationRequest'
    ];

    for (const model of models) {
        const filePath = path.join(exportFolder, `${model}.json`);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${model} (file not found)`);
            continue;
        }

        try {
            console.log(`Importing ${model}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Clear existing data (CAUTION: wipes the table first)
            await prisma[model].deleteMany();
            
            // Bulk insert
            if (data.length > 0) {
                await prisma[model].createMany({
                    data: data,
                    skipDuplicates: true
                });
            }
            console.log(`Successfully imported ${data.length} records into ${model}`);
        } catch (error) {
            console.error(`Error importing ${model}:`, error.message);
        }
    }

    console.log('--- Import Finished! ---');
}

importAll()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

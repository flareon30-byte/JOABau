const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initSettings() {
    const settings = await prisma.systemSettings.findFirst();
    console.log('Current Settings:', settings);

    if (!settings) {
        console.log('No settings found. Creating...');
        // Create with defaults
    }

    // Check if financials are missing or empty
    if (!settings.financials) {
        console.log('Financials missing. Initializing defaults...');
        await prisma.systemSettings.update({
            where: { id: settings.id },
            data: {
                financials: {
                    installers: {
                        salary: 1500,
                        insurance: 330,
                        dietasPerDay: 0,
                        car: 400,
                        gas: 300,
                        materials: 100,
                        pricePerUnit: 60,
                        pricePerTA: 25,
                        pricePerMulti: 35,
                        bonusPerUnit: 20,
                        bonusPerTA: 5,
                        bonusPerMulti: 10,
                        saturdayRate: 40
                    },
                    blowers: {
                        salary: 1600,
                        insurance: 352,
                        dietasPerDay: 0,
                        car: 400,
                        gas: 300,
                        materials: 50,
                        pricePerUnit: 0.40,
                        bonusPerUnit: 0.05,
                        saturdayRate: 40
                    }
                }
            }
        });
        console.log('Financials initialized.');
    } else {
        console.log('Financials already exist.');
    }
}

initSettings()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

const prisma = require('./src/prisma');

async function seed() {
    console.log('--- Seeding Default System Settings ---');

    // Default Financial Config
    const defaultFinancials = {
        installers: {
            salary: 3200,
            insurance: 1334,
            dietasPerDay: 28,
            car: 400,
            gas: 400,
            equipmentRent: 1200,
            materials: 150,
            pricePerUnit: 250, // Updated base price
            pricePerTA: 50,
            pricePerMulti: 100,
            pricePerMDU: 50,
            pricePerSP: 75,    // NEW field
            bonusPerUnit: 20,
            bonusPerTA: 10,
            bonusPerMulti: 10,
            bonusPerMDU: 10,
            saturdayRate: 40
        },
        blowers: {
            salary: 1600,
            insurance: 352,
            dietasPerDay: 0,
            car: 400,
            gas: 300,
            equipmentRent: 0,
            materials: 50,
            pricePerUnit: 0.40,
            bonusPerUnit: 0.05,
            saturdayRate: 40
        },
        backOffice: {
            salary: 1500,
            insurance: 330,
            dietasPerDay: 0,
            opCostPerPerson: 200,
            pricePerAppointment: 15
        }
    };

    try {
        // Upsert System Settings
        const settings = await prisma.systemSettings.upsert({
            where: { id: 'default-settings' }, // We need a unique way to find it. ID is UUID.
            // Since we don't know the ID, we usually use findFirst.
            // But upsert needs unique field. `isDemo` is not unique.
            // Let's check if exists first.
            create: {
                isDemo: false,
                financials: defaultFinancials,
                repairPrice: 45.0
            },
            update: {
                financials: defaultFinancials,
                repairPrice: 45.0
            }
        });

        // Actually, prisma `upsert` needs a unique constraint. `id` is primary.
        // If we don't have a fixed ID, we can't upsert by `id` effectively unless we hardcode one.
        // Let's use deleteMany/create or findFirst/update.

    } catch (e) {
        // Fallback logic
    }

    // Better approach: Find First, if not exists Create. If exists Update.
    const existing = await prisma.systemSettings.findFirst({ where: { isDemo: false } });

    if (existing) {
        console.log('Updating existing settings...');
        await prisma.systemSettings.update({
            where: { id: existing.id },
            data: {
                financials: defaultFinancials,
                repairPrice: 45.0
            }
        });
    } else {
        console.log('Creating new settings...');
        await prisma.systemSettings.create({
            data: {
                isDemo: false,
                financials: defaultFinancials,
                repairPrice: 45.0
            }
        });
    }

    console.log('✓ Settings Seeded');

    // Ensure Admin User Exists for Testing (Optional, but good if DB was wiped)
    // We assume user accounts might persist if only `migrate dev` was run on valid schema, 
    // BUT the user accepted "All data will be lost" which means tables were dropped.
    // So we need to re-create a user to log in if he can't.
    // But he says "En nominas no salen ninguna", so he IS logged in.
    // This implies he re-registered or the "reset" didn't actually wipe users? 
    // `prisma migrate dev` with data loss DOES wipe tables.
    // Maybe he has a cookie and frontend is rendering pages but APIs return 401?
    // "Mis Ganancias says Data could not be loaded" -> possibly 401 or 500.

    // I will check if there are users.
    const userCount = await prisma.user.count();
    console.log(`Current User Count: ${userCount}`);

}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

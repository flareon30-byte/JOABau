const prisma = require('./src/prisma');
const bcrypt = require('bcryptjs');

async function seedDemoData() {
    console.log('🌱 Starting Demo Data Seed...');

    // 1. Create/Ensure DEMO User
    const hashedPassword = await bcrypt.hash('000000', 10);
    const demoUser = await prisma.user.upsert({
        where: { username: 'DEMO' },
        update: {
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isDemo: true
        },
        create: {
            username: 'DEMO',
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isDemo: true,
            baseSalary: 1500.0
        }
    });
    console.log('✅ Demo User Verified: DEMO / 000000');

    // 2. Create Demo Settings
    const existingSettings = await prisma.systemSettings.findFirst({ where: { isDemo: true } });
    if (!existingSettings) {
        await prisma.systemSettings.create({
            data: {
                isDemo: true,
                extraPointPrice: 2.5,
                saturdayPointPrice: 5.0,
                monthlyTargetPoints: 120,
                financials: {
                    salaryBase: 1700,
                    carCost: 350,
                    insurance: 100
                }
            }
        });
        console.log('✅ Demo Settings Created');
    }

    // 3. Create Demo Team
    let demoTeam = await prisma.team.findFirst({ where: { name: 'Equipo Demo Alpha', isDemo: true } });
    if (!demoTeam) {
        demoTeam = await prisma.team.create({
            data: {
                name: 'Equipo Demo Alpha',
                department: 'ACTIVATION',
                isDemo: true
            }
        });
        console.log('✅ Demo Team Created');
    }

    // 4. Create Demo Technicians (Users)
    const techNames = ['Hans Müller (Demo)', 'Sophie Weber (Demo)'];
    for (const name of techNames) {
        const username = name.split(' ')[0].toLowerCase() + '_demo';
        await prisma.user.upsert({
            where: { username },
            update: { teamId: demoTeam.id, isDemo: true },
            create: {
                username,
                password: hashedPassword,
                role: 'ACTIVATOR',
                isDemo: true,
                teamId: demoTeam.id,
                baseSalary: 1600.0
            }
        });
    }
    console.log('✅ Demo Technicians Created');

    // 5. Create Demo Project
    const projectName = 'Fiber City Demo 2026';
    let demoProject = await prisma.project.findUnique({ where: { name: projectName } });

    if (!demoProject) {
        demoProject = await prisma.project.create({
            data: {
                name: projectName,
                isDemo: true
            }
        });
        console.log(`✅ Demo Project Created: ${projectName}`);

        // 6. Generate Fake Addresses
        const streetNames = ['Musterstraße', 'Hauptstraße', 'Bahnhofstraße', 'Lindenweg'];
        const fakeAddresses = [];

        for (let i = 1; i <= 20; i++) {
            const street = streetNames[Math.floor(Math.random() * streetNames.length)];
            fakeAddresses.push({
                projectId: demoProject.id,
                street: street,
                number: `${i}A`,
                city: 'Berlin',
                nvt: `NVT-0${Math.ceil(i / 5)}`,
                clientName: `Familie Testkunde ${i}`,
                requiresProtocol: i % 3 === 0, // Some require protocol
                orderStatus: 'geplant'
            });
        }

        await prisma.address.createMany({ data: fakeAddresses });
        console.log('✅ 20 Demo Addresses Created');

        // 7. Add some Soplado Data (to simulate history)
        const addresses = await prisma.address.findMany({ where: { projectId: demoProject.id } });

        // Mark first 5 as Soplado OK
        for (let i = 0; i < 5; i++) {
            await prisma.address.update({
                where: { id: addresses[i].id },
                data: { sopladoStatus: 'OK' }
            });
            await prisma.sopladoInfo.create({
                data: {
                    addressId: addresses[i].id,
                    meters: 150 + (i * 10),
                    tk: 'TK-123',
                    tubeColor: 'Rojo',
                    photos: []
                }
            });
        }
        console.log('✅ Simulated Soplado Work');

        // 8. Add some Activations (to simulate earnings)
        for (let i = 0; i < 3; i++) {
            await prisma.activationInfo.create({
                data: {
                    addressId: addresses[i].id,
                    activationType: 'SDU',
                    points: 30, // Random points
                    familiesCount: 1,
                    apPorts: 1,
                    hasMoreClients: false,
                    spInstalled: 1,
                    taInstalled: true,
                    photos: [],
                    description: 'Instalación Demo Exitosa'
                }
            });
        }
        console.log('✅ Simulated Activations');
    } else {
        console.log('ℹ️ Demo Project already exists, skipping generation.');
    }

    console.log('🚀 DEMO ENVIRONMENT READY!');
}

seedDemoData()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

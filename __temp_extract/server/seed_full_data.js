const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function seedData() {
    console.log('--- Seeding Project, Addresses, and Activations ---');

    // 1. Ensure a user (Tech) exists
    const hashedPassword = await bcrypt.hash('tech123', 10);
    const tech = await prisma.user.upsert({
        where: { username: 'tecnico1' },
        update: {},
        create: {
            username: 'tecnico1',
            password: hashedPassword,
            role: 'ACTIVATOR',
            baseSalary: 1500,
            isDemo: false
        }
    });

    // 2. Ensure a Team exists
    const team = await prisma.team.upsert({
        where: { id: 'team-instaladores-a' },
        update: {},
        create: {
            id: 'team-instaladores-a',
            name: 'Instaladores A',
            department: 'ACTIVATION',
            members: { connect: { id: tech.id } }
        }
    });

    // 3. Ensure a Project exists
    const project = await prisma.project.upsert({
        where: { name: 'Proyecto Demo' },
        update: {},
        create: {
            name: 'Proyecto Demo',
            isDemo: false
        }
    });

    // 4. Create Addresses & Appointments (Some Pending, Some Completed)

    // Address 1: Pending Activation
    const address1 = await prisma.address.create({
        data: {
            projectId: project.id,
            street: 'Calle Demo',
            number: '1',
            city: 'Ciudad Demo',
            clientName: 'Cliente Pendiente',
            nvt: 'NVT-01',
            appointment: {
                create: {
                    status: 'CITADO',
                    assignedTeamId: team.id,
                    assignedDate: new Date(),
                    clientName: 'Cliente Pendiente',
                    apartmentCount: 1
                }
            }
        }
    });

    // Address 2: Completed Activation (With new fields populated)
    const address2 = await prisma.address.create({
        data: {
            projectId: project.id,
            street: 'Calle Demo',
            number: '2',
            city: 'Ciudad Demo',
            clientName: 'Cliente Completado',
            nvt: 'NVT-01',
            appointment: {
                create: {
                    status: 'COMPLETADO',
                    assignedTeamId: team.id,
                    assignedDate: new Date(),
                    clientName: 'Cliente Completado',
                    apartmentCount: 1
                }
            },
            activationInfo: {
                create: {
                    activationType: 'BP',
                    familiesCount: 1,
                    apPorts: 2,
                    hasMoreClients: false,
                    spInstalled: 3, // 3 SPs
                    taInstalled: true,
                    taCount: 1, // 1 TA
                    mduInstalled: false,
                    isRepair: false,
                    points: 10 + (3 * 5) + 25, // Legacy points calculation (approx)

                    // NEW FINANCIAL SNAPSHOTS
                    basePrice: 250,
                    spPrice: 225, // 3 * 75
                    taPrice: 50,
                    mduPrice: 0,
                    repairPrice: 0,

                    photos: [],
                    description: 'Instalación de ejemplo con SP y TA.'
                }
            }
        }
    });

    // Address 3: Completed Repair (Facturable)
    const address3 = await prisma.address.create({
        data: {
            projectId: project.id,
            street: 'Calle Averia',
            number: '5',
            city: 'Ciudad Demo',
            clientName: 'Cliente Averia',
            nvt: 'NVT-02',
            appointment: {
                create: {
                    status: 'COMPLETADO',
                    assignedTeamId: team.id,
                    assignedDate: new Date(),
                    clientName: 'Cliente Averia',
                    apartmentCount: 1
                }
            },
            activationInfo: {
                create: {
                    activationType: 'BP', // Maybe dummy type if repair only? Or keep BP as base but 0 basePrice?
                    // Usually repairs might not have activation info if they are pure repairs, 
                    // but if registered through activation form:
                    familiesCount: 1,
                    apPorts: 0,
                    hasMoreClients: false,
                    spInstalled: 0,
                    taInstalled: false,
                    isRepair: true,
                    points: 0,

                    // Financials
                    basePrice: 0, // Only repair billable? Or base + repair?
                    spPrice: 0,
                    taPrice: 0,
                    mduPrice: 0,
                    repairPrice: 45, // Fixed repair price

                    description: 'Reparación facturable.'
                }
            }
        }
    });

    console.log('✓ Seed Data Created: Project, Team, Technicians, Addresses, Appointments (Pending & Completed)');
}

seedData()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

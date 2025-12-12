const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function main() {
    console.log('Cleaning database...');
    await prisma.activationInfo.deleteMany({});
    await prisma.appointment.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } }); // Keep Super Admin
    await prisma.team.deleteMany({});

    console.log('Seeding test data...');

    // 1. Create Teams
    const team1 = await prisma.team.create({
        data: {
            name: 'Equipo 1',
            department: 'ACTIVATION',
            members: {
                create: {
                    username: 'activator1',
                    password: await bcrypt.hash('123456', 10),
                    role: 'ACTIVATOR'
                }
            }
        },
        include: { members: true }
    });
    console.log('Created Team:', team1.name);

    const teamBO = await prisma.team.create({
        data: {
            name: 'BackOffice Team',
            department: 'BACK_OFFICE',
            members: {
                create: {
                    username: 'backoffice1',
                    password: await bcrypt.hash('123456', 10),
                    role: 'BACK_OFFICE'
                }
            }
        }
    });
    console.log('Created Team:', teamBO.name);

    // 2. Create Project
    const project = await prisma.project.create({
        data: {
            name: 'Proyecto Fibra Centro'
        }
    });
    console.log('Created Project:', project.name);

    // 3. Create Address & Appointment
    // Create a date for today/tomorrow to ensure it appears in the dashboard
    const today = new Date();

    const address = await prisma.address.create({
        data: {
            street: 'Calle Principal',
            number: '123',
            projectId: project.id,
            appointment: {
                create: {
                    clientName: 'Juan Pérez',
                    apartmentCount: 1,
                    status: 'CITADO',
                    assignedDate: today,
                    assignedTeamId: team1.id
                }
            }
        }
    });
    console.log('Created Address & Appointment for:', address.street);

    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

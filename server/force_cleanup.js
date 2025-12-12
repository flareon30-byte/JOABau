const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting force cleanup...');

        // 1. Delete Users
        const usersToDelete = ['activator1', 'backoffice1'];
        for (const username of usersToDelete) {
            try {
                const user = await prisma.user.findUnique({ where: { username } });
                if (user) {
                    await prisma.user.delete({ where: { id: user.id } });
                    console.log(`Deleted user: ${username}`);
                } else {
                    console.log(`User not found: ${username}`);
                }
            } catch (e) {
                console.error(`Failed to delete user ${username}:`, e.message);
            }
        }

        // 2. Delete Teams
        const teamsToDelete = ['Equipo 1', 'BackOffice Team', 'Test Delete Team'];
        for (const name of teamsToDelete) {
            try {
                const team = await prisma.team.findFirst({ where: { name } });
                if (team) {
                    // Manually unlink dependencies just in case
                    await prisma.user.updateMany({
                        where: { teamId: team.id },
                        data: { teamId: null }
                    });
                    await prisma.appointment.updateMany({
                        where: { assignedTeamId: team.id },
                        data: { assignedTeamId: null }
                    });

                    await prisma.team.delete({ where: { id: team.id } });
                    console.log(`Deleted team: ${name}`);
                } else {
                    console.log(`Team not found: ${name}`);
                }
            } catch (e) {
                console.error(`Failed to delete team ${name}:`, e.message);
            }
        }

        // 3. Delete Project
        const projectName = 'Proyecto Fibra Centro';
        try {
            const project = await prisma.project.findUnique({ where: { name: projectName } });
            if (project) {
                // Deep clean project
                const addresses = await prisma.address.findMany({
                    where: { projectId: project.id },
                    select: { id: true }
                });
                const addressIds = addresses.map(a => a.id);

                if (addressIds.length > 0) {
                    await prisma.activationInfo.deleteMany({ where: { addressId: { in: addressIds } } });
                    await prisma.sopladoInfo.deleteMany({ where: { addressId: { in: addressIds } } });
                    await prisma.fusionInfo.deleteMany({ where: { addressId: { in: addressIds } } });

                    const appointments = await prisma.appointment.findMany({
                        where: { addressId: { in: addressIds } },
                        select: { id: true }
                    });
                    const appointmentIds = appointments.map(a => a.id);

                    if (appointmentIds.length > 0) {
                        await prisma.comment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
                        await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
                    }

                    await prisma.address.deleteMany({ where: { projectId: project.id } });
                }

                await prisma.project.delete({ where: { id: project.id } });
                console.log(`Deleted project: ${projectName}`);
            } else {
                console.log(`Project not found: ${projectName}`);
            }
        } catch (e) {
            console.error(`Failed to delete project ${projectName}:`, e.message);
        }

    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

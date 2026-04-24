const prisma = require('./src/prisma');

async function main() {
    console.log('--- Users & Teams ---');
    const users = await prisma.user.findMany({
        include: { team: true }
    });
    users.forEach(u => {
        console.log(`User: ${u.username} (ID: ${u.id})`);
        console.log(`  Role: ${u.role}`);
        console.log(`  Team: ${u.team?.name} (ID: ${u.team?.id})`);
    });

    console.log('\n--- Appointments ---');
    const appointments = await prisma.appointment.findMany({
        include: { assignedTeam: true, address: true }
    });
    appointments.forEach(a => {
        console.log(`Appointment at ${a.address.street} (ID: ${a.id})`);
        console.log(`  Status: ${a.status}`);
        console.log(`  Assigned Date: ${a.assignedDate}`);
        console.log(`  Assigned Team: ${a.assignedTeam?.name} (ID: ${a.assignedTeamId})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

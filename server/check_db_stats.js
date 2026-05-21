const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const counts = {
            users: await prisma.user.count(),
            projects: await prisma.project.count(),
            addresses: await prisma.address.count(),
            appointments: await prisma.appointment.count(),
            fusionWorks: await prisma.fusionWork.count(),
            activationInfos: await prisma.activationInfo.count(),
            sopladoInfos: await prisma.sopladoInfo.count()
        };
        console.log("DATABASE COUNTS:");
        console.log(JSON.stringify(counts, null, 2));

        const projects = await prisma.project.findMany({ select: { id: true, name: true } });
        console.log("PROJECTS:", projects);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();

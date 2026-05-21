const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const projectId = '5483700a-9ed3-409a-91dd-50b714860ba3';
    const userId = 'f58842b1-d83b-4a41-8165-8b16145116f4';
    
    // Simulate req.body
    const type = 'MUFFA';
    const address = 'GPS: 40.41678, -3.70379';
    const hours = '2.5';
    const fusionCount = '8';
    const isTray = 'false';
    const description = 'Test Muffa creation';
    const photoPaths = ['uploads/test-photo.jpg'];

    try {
        const work = await prisma.fusionWork.create({
            data: {
                projectId,
                nvtName: null,
                type: type || 'NVT',
                address: address || null,
                hours: hours ? parseFloat(hours) : null,
                fusionCount: parseInt(fusionCount),
                isTray: isTray === 'true' || isTray === true,
                description,
                photos: photoPaths,
                createdById: userId
            }
        });
        console.log("CREATED WORK:", JSON.stringify(work, null, 2));
    } catch (e) {
        console.error("Prisma error inserting fusionWork:", e);
    }
    await prisma.$disconnect();
}
run();

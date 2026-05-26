const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting Soplado status mismatch repair script...');

        // 1. Get all projects
        const projects = await prisma.project.findMany();
        console.log(`Found ${projects.length} projects.`);

        let totalRepaired = 0;

        for (const project of projects) {
            console.log(`Processing project: ${project.name} (${project.id})...`);

            // Fetch all addresses in this project that are OK or FALLIDO and have sopladoInfo
            const blownAddresses = await prisma.address.findMany({
                where: {
                    projectId: project.id,
                    sopladoStatus: { in: ['OK', 'FALLIDO'] }
                },
                include: {
                    sopladoInfo: true
                }
            });

            // Group them by building key (street + number)
            const buildingSopladoMap = new Map();
            for (const addr of blownAddresses) {
                if (!addr.street) continue;
                const key = `${addr.street.trim().toLowerCase()}|${(addr.number || '').trim().toLowerCase()}`;
                const existingMatch = buildingSopladoMap.get(key);
                if (addr.sopladoInfo) {
                    if (!existingMatch || (existingMatch.sopladoStatus === 'FALLIDO' && addr.sopladoStatus === 'OK')) {
                        buildingSopladoMap.set(key, {
                            sopladoStatus: addr.sopladoStatus,
                            sopladoInfo: addr.sopladoInfo
                        });
                    }
                }
            }

            console.log(`- Detected ${buildingSopladoMap.size} blown buildings in project.`);

            // Fetch all addresses in the project
            const allAddresses = await prisma.address.findMany({
                where: { projectId: project.id },
                include: { sopladoInfo: true }
            });

            // Check and propagate status/info
            let projectRepaired = 0;
            for (const addr of allAddresses) {
                if (!addr.street) continue;
                const key = `${addr.street.trim().toLowerCase()}|${(addr.number || '').trim().toLowerCase()}`;
                const info = buildingSopladoMap.get(key);

                if (info) {
                    const statusMismatch = addr.sopladoStatus !== info.sopladoStatus;
                    const infoMissing = !addr.sopladoInfo;

                    if (statusMismatch || infoMissing) {
                        console.log(`  -> Repairing sibling address: ID=${addr.id}, Street="${addr.street}", Number="${addr.number || ''}"`);
                        console.log(`     Old Status: ${addr.sopladoStatus} -> New Status: ${info.sopladoStatus}`);

                        // Update address status
                        await prisma.address.update({
                            where: { id: addr.id },
                            data: { sopladoStatus: info.sopladoStatus }
                        });

                        // Prepare SopladoInfo details to copy
                        const sopladoInfoData = {
                            meters: info.sopladoInfo.meters,
                            tk: info.sopladoInfo.tk,
                            tubeColor: info.sopladoInfo.tubeColor,
                            teamId: info.sopladoInfo.teamId,
                            isSaturday: info.sopladoInfo.isSaturday,
                            failureReason: info.sopladoInfo.failureReason,
                            photos: info.sopladoInfo.photos,
                            saturdayPay: info.sopladoInfo.saturdayPay,
                            performerIds: info.sopladoInfo.performerIds
                        };

                        // Upsert SopladoInfo for this address
                        await prisma.sopladoInfo.upsert({
                            where: { addressId: addr.id },
                            update: sopladoInfoData,
                            create: {
                                addressId: addr.id,
                                ...sopladoInfoData
                            }
                        });

                        projectRepaired++;
                        totalRepaired++;
                    }
                }
            }

            console.log(`- Repaired ${projectRepaired} mismatched addresses in this project.`);
        }

        console.log(`Successfully completed! Total repaired addresses across all projects: ${totalRepaired}`);

    } catch (e) {
        console.error('Error during repair:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

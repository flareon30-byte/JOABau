const prisma = require('../prisma');

// Get addresses for a specific project
exports.getProjectAddresses = async (req, res) => {
    const { projectId } = req.params;
    const { search } = req.query;

    try {
        const where = {
            projectId,
            // Filter out completed or cancelled orders
            // User rule: Only show if NOT Installiert AND NOT Abgebrochen
            orderStatus: {
                notIn: ['Installiert', 'Abgebrochen']
            }
        };

        if (search) {
            where.OR = [
                { nvt: { contains: search, mode: 'insensitive' } },
                { street: { contains: search, mode: 'insensitive' } }
            ];
        }

        const rawAddresses = await prisma.address.findMany({
            where,
            include: {
                sopladoInfo: true
            },
            take: 200 // Increase take to ensure we get enough distinct items
        });

        // Manual deduplication if Prisma distinct fails or behaves unexpectedly
        const seen = new Set();
        const addresses = rawAddresses.filter(addr => {
            const s = addr.street ? addr.street.trim().toLowerCase() : '';
            const n = addr.number ? addr.number.trim().toLowerCase() : '';
            const key = `${s}|${n}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => a.street.localeCompare(b.street));

        console.log(`Soplado: Raw fetched ${rawAddresses.length} -> Deduplicated to ${addresses.length}`);

        // Trim to final page size if needed, though client-side pagination is likely better
        // addresses.length = Math.min(addresses.length, 50);

        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching addresses' });
    }
};

// Submit Soplado Report (OK or Failed)
exports.submitSopladoReport = async (req, res) => {
    const { addressId } = req.params;
    const { status, meters, tk, tubeColor, failureReason } = req.body;
    const files = req.files; // Array of files from multer

    try {
        const photoPaths = files ? files.map(f => f.path) : [];

        // 1. Get the target address details to identify the physical location
        const targetAddress = await prisma.address.findUnique({
            where: { id: addressId }
        });

        if (!targetAddress) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // 2. Find ALL addresses at this exact physical location (same project, street, number)
        // This ensures that if there are multiple clients at the same address, they all get updated.
        const relatedAddresses = await prisma.address.findMany({
            where: {
                projectId: targetAddress.projectId,
                street: { equals: targetAddress.street, mode: 'insensitive' },
                number: { equals: targetAddress.number, mode: 'insensitive' }
            },
            select: { id: true }
        });
        const relatedIds = relatedAddresses.map(a => a.id);

        // Transaction to ensure consistency
        const result = await prisma.$transaction(async (prisma) => {
            console.log(`Updating status to ${status} for ${relatedIds.length} addresses:`, relatedIds);

            // 3. Update Address Status for ALL related addresses
            const updateResult = await prisma.address.updateMany({
                where: { id: { in: relatedIds } },
                data: { sopladoStatus: status }
            });
            console.log('Update many result:', updateResult);

            // 4. Create or Update SopladoInfo for ALL related addresses
            const sopladoInfoData = {
                meters: parseFloat(meters) || 0,
                tk: tk || '',
                tubeColor: tubeColor || '',
                failureReason: status === 'FALLIDO' ? failureReason : null,
                photos: photoPaths
            };

            // We must upsert one by one because sopladoInfo is 1:1 unique on addressId
            const upsertPromises = relatedIds.map(id =>
                prisma.sopladoInfo.upsert({
                    where: { addressId: id },
                    update: sopladoInfoData,
                    create: {
                        addressId: id,
                        ...sopladoInfoData
                    }
                })
            );

            await Promise.all(upsertPromises);
            console.log('Soplado Info upserted successfully.');

            return { message: 'Report updated for all clients at location', updatedCount: relatedIds.length };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting report' });
    }
};

// Toggle Status (Quick Action)
exports.toggleSopladoStatus = async (req, res) => {
    const { addressId } = req.params;
    const { status } = req.body; // 'OK', 'PENDIENTE', 'FALLIDO'

    try {
        const targetAddress = await prisma.address.findUnique({
            where: { id: addressId }
        });

        if (!targetAddress) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Apply to ALL addresses at this location (same street/number logic)
        const relatedAddresses = await prisma.address.findMany({
            where: {
                projectId: targetAddress.projectId,
                street: { equals: targetAddress.street, mode: 'insensitive' },
                number: { equals: targetAddress.number, mode: 'insensitive' }
            },
            select: { id: true }
        });
        const relatedIds = relatedAddresses.map(a => a.id);

        console.log(`Toggling status to ${status} for ${relatedIds.length} addresses. IDs: ${relatedIds.join(', ')}`);

        await prisma.$transaction(async (prisma) => {
            // 1. Update Status for Address
            // If status is PENDIENTE, we clear it (or set to PENDIENTE explicit enum)
            // Enum is OK, FALLIDO, PENDIENTE.
            const newStatus = status === 'PENDIENTE' ? 'PENDIENTE' : status;

            await prisma.address.updateMany({
                where: { id: { in: relatedIds } },
                data: { sopladoStatus: newStatus }
            });

            // 2. Manage SopladoInfo
            if (status === 'OK' || status === 'FALLIDO') {
                // Upsert with dummy data
                const dummyData = {
                    meters: 0,
                    tk: 'N/A',
                    tubeColor: 'N/A',
                    failureReason: null,
                    photos: []
                };

                // We promise.all the upserts
                const upsertPromises = relatedIds.map(id =>
                    prisma.sopladoInfo.upsert({
                        where: { addressId: id },
                        update: dummyData, // Overwrite with dummy if quick toggle is used
                        create: {
                            addressId: id,
                            ...dummyData
                        }
                    })
                );
                await Promise.all(upsertPromises);

            } else if (status === 'PENDIENTE') {
                // Remove Info to revert state cleanly
                await prisma.sopladoInfo.deleteMany({
                    where: { addressId: { in: relatedIds } }
                });
            }
        });

        res.json({ message: 'Status updated successfully', status, count: relatedIds.length });

    } catch (error) {
        console.error('Error toggling soplado status:', error);
        res.status(500).json({ message: 'Error updating status' });
    }
};
// Bulk Update Status
exports.bulkUpdateSopladoStatus = async (req, res) => {
    const { addressIds, status } = req.body; // status: 'OK', 'PENDIENTE', 'FALLIDO'

    if (!addressIds || !Array.isArray(addressIds) || addressIds.length === 0) {
        return res.status(400).json({ message: 'No addresses provided' });
    }

    try {
        await prisma.$transaction(async (prisma) => {
            for (const id of addressIds) {
                // 1. Find address to get location info
                const target = await prisma.address.findUnique({ where: { id } });
                if (!target) continue;

                // 2. Find all related (same project, street, number) to ensure consistent update for location
                const related = await prisma.address.findMany({
                    where: {
                        projectId: target.projectId,
                        street: { equals: target.street, mode: 'insensitive' },
                        number: { equals: target.number, mode: 'insensitive' }
                    },
                    select: { id: true }
                });
                const idsToUpdate = related.map(r => r.id);

                // 3. Update Address Status
                const newStatus = status === 'PENDIENTE' ? 'PENDIENTE' : status;
                await prisma.address.updateMany({
                    where: { id: { in: idsToUpdate } },
                    data: { sopladoStatus: newStatus }
                });

                // 4. Update/Delete Info
                if (status === 'OK' || status === 'FALLIDO') {
                    const dummyData = {
                        meters: 0,
                        tk: 'N/A',
                        tubeColor: 'N/A',
                        failureReason: null,
                        photos: []
                    };

                    // Upsert individually
                    for (const rid of idsToUpdate) {
                        await prisma.sopladoInfo.upsert({
                            where: { addressId: rid },
                            update: dummyData,
                            create: { addressId: rid, ...dummyData }
                        });
                    }
                } else if (status === 'PENDIENTE') {
                    await prisma.sopladoInfo.deleteMany({
                        where: { addressId: { in: idsToUpdate } }
                    });
                }
            }
        });

        res.json({ message: 'Bulk update successful', count: addressIds.length });

    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ message: 'Error updating statuses' });
    }
};

const prisma = require('../prisma');

exports.getMapData = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            include: {
                civilWorkInfo: true,
                project: true,
                simpleInstallation: {
                    select: { gpsLat: true, gpsLng: true }
                }
            }
        });

        const activeWorkers = await prisma.locationLog.findMany({
            orderBy: { timestamp: 'desc' },
            distinct: ['userId'],
            include: { user: { select: { username: true, role: true } } },
            where: {
                timestamp: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } // Last 12 hours
            }
        });

        res.json({ addresses, activeWorkers });
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateCivilWorkStatus = async (req, res) => {
    const { id } = req.params; // addressId
    const { status, metersTrench, surfaceType, photos, actionLat, actionLng } = req.body;
    const userId = req.userId; // from authMiddleware

    try {
        let civilWork = await prisma.civilWorkInfo.findUnique({ where: { addressId: id } });

        const updateData = {
            metersTrench: metersTrench ? parseFloat(metersTrench) : undefined,
            surfaceType,
            photos: photos || [],
        };

        if (civilWork) {
            civilWork = await prisma.civilWorkInfo.update({
                where: { addressId: id },
                data: {
                    ...updateData,
                    performerIds: { push: userId }
                }
            });
        } else {
            civilWork = await prisma.civilWorkInfo.create({
                data: {
                    addressId: id,
                    metersTrench: metersTrench ? parseFloat(metersTrench) : 0,
                    surfaceType,
                    photos: photos || [],
                    performerIds: [userId],
                    startedAt: new Date()
                }
            });
        }

        if (status) {
            await prisma.address.update({
                where: { id },
                data: { civilWorkStatus: status }
            });
        }

        // Log location if provided
        if (actionLat && actionLng) {
            await prisma.locationLog.create({
                data: {
                    userId,
                    gpsLat: parseFloat(actionLat),
                    gpsLng: parseFloat(actionLng),
                    action: 'UPDATE_CIVIL_WORK',
                    addressId: id
                }
            });
        }

        res.json({ message: 'Civil work updated successfully', civilWork });
    } catch (error) {
        console.error('Error updating civil work:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.logLocation = async (req, res) => {
    const { lat, lng, action, addressId } = req.body;
    const userId = req.userId;

    try {
        const log = await prisma.locationLog.create({
            data: {
                userId,
                gpsLat: parseFloat(lat),
                gpsLng: parseFloat(lng),
                action: action || 'CHECK_IN',
                addressId
            }
        });
        res.json({ message: 'Location logged', log });
    } catch (error) {
        console.error('Error logging location:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

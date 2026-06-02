const prisma = require('../prisma');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs');

// Helper to extract GPS metadata from uploaded photo using exifr
async function extractGpsFromImage(relativeUrl) {
    try {
        if (!relativeUrl) return null;
        // Clean up URL to get local file path
        const cleanPath = relativeUrl.split('?')[0].replace(/^\//, '');
        const fullPath = path.join(__dirname, '../../', cleanPath);
        
        if (!fs.existsSync(fullPath)) {
            console.warn(`[EXIF Parser] File not found: ${fullPath}`);
            return null;
        }

        const gps = await exifr.gps(fullPath).catch(() => null);
        const meta = await exifr.parse(fullPath, ['DateTimeOriginal']).catch(() => null);
        
        if (gps && gps.latitude && gps.longitude) {
            return {
                lat: gps.latitude,
                lng: gps.longitude,
                timestamp: meta?.DateTimeOriginal || new Date()
            };
        }
    } catch (error) {
        console.error(`[EXIF Parser] Error parsing image EXIF:`, error);
    }
    return null;
}

exports.getMapData = async (req, res) => {
    try {
        // Fetch all addresses with their civil work status and info
        const addresses = await prisma.address.findMany({
            include: {
                civilWorkInfo: true,
                project: true
            }
        });

        // Fetch active workers logged within last 12 hours
        const activeWorkers = await prisma.locationLog.findMany({
            orderBy: { timestamp: 'desc' },
            distinct: ['userId'],
            include: { user: { select: { username: true, role: true } } },
            where: {
                timestamp: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
            }
        });

        // Fetch all confirmed daily duct log routes for map drawing
        const ductRoutes = await prisma.civilDailyDuctLog.findMany({
            where: { confirmed: true },
            include: {
                report: {
                    include: { subcontractor: true }
                }
            }
        });

        res.json({ addresses, activeWorkers, ductRoutes });
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateCivilWorkStatus = async (req, res) => {
    const { id } = req.params; // addressId
    const { status, metersTrench, surfaceType, photos, actionLat, actionLng, gpsLat, gpsLng } = req.body;
    const userId = req.userId;

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

        const addressUpdate = {};
        if (status) addressUpdate.civilWorkStatus = status;
        if (gpsLat !== undefined) addressUpdate.gpsLat = parseFloat(gpsLat);
        if (gpsLng !== undefined) addressUpdate.gpsLng = parseFloat(gpsLng);

        if (Object.keys(addressUpdate).length > 0) {
            await prisma.address.update({
                where: { id },
                data: addressUpdate
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

// --- NEW SUBCONTRACTOR OPERATIONS ---

exports.getAssignedPipes = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subcontractor: true }
        });

        if (!user.subcontractorId) {
            return res.status(400).json({ message: 'El usuario no tiene una subcontrata asociada.' });
        }

        const addresses = await prisma.address.findMany({
            where: {
                project: {
                    subcontractorId: user.subcontractorId
                }
            },
            include: {
                civilWorkInfo: true,
                project: true
            },
            orderBy: { street: 'asc' }
        });

        res.json(addresses);
    } catch (error) {
        console.error('Error fetching assigned pipes:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAddressesSearch = async (req, res) => {
    const { query } = req.query;
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        const filter = {
            OR: [
                { street: { contains: query, mode: 'insensitive' } },
                { nvt: { contains: query, mode: 'insensitive' } }
            ]
        };

        // If subcontractor worker, filter by their subcontractor projects only
        if (user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
            filter.project = { subcontractorId: user.subcontractorId };
        }

        const addresses = await prisma.address.findMany({
            where: filter,
            include: { project: true, civilWorkInfo: true },
            take: 30
        });

        res.json(addresses);
    } catch (error) {
        console.error('Error searching addresses:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- DAILY REPORT SUBMISSION & LISTING ---

exports.submitDailyReport = async (req, res) => {
    const userId = req.userId;
    const { date, peoplePresent, comments, workLogs, ductLogs } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subcontractor: true }
        });

        if (!user.subcontractorId) {
            return res.status(400).json({ message: 'No estás asignado a ninguna subcontrata.' });
        }

        // 1. Create Daily Report
        const report = await prisma.civilDailyReport.create({
            data: {
                subcontractorId: user.subcontractorId,
                date: new Date(date || Date.now()),
                peoplePresent: parseInt(peoplePresent) || 0,
                comments: comments || null
            }
        });

        // 2. Process work logs for connections (acometidas)
        if (workLogs && Array.isArray(workLogs)) {
            for (const log of workLogs) {
                // Save Work Log in Daily Report
                await prisma.civilDailyWorkLog.create({
                    data: {
                        reportId: report.id,
                        addressId: log.addressId,
                        status: log.status,
                        photos: log.photos || [],
                        comments: log.comments || null,
                        ready: log.ready || false
                    }
                });

                // Update physical address status and details
                const finalStatus = log.ready ? 'HECHO' : log.status;
                
                await prisma.address.update({
                    where: { id: log.addressId },
                    data: { civilWorkStatus: finalStatus }
                });

                // Upsert CivilWorkInfo
                const existingInfo = await prisma.civilWorkInfo.findUnique({ where: { addressId: log.addressId } });
                if (existingInfo) {
                    await prisma.civilWorkInfo.update({
                        where: { addressId: log.addressId },
                        data: {
                            photos: { push: log.photos || [] },
                            performerIds: { push: userId },
                            completedAt: finalStatus === 'HECHO' ? new Date() : undefined
                        }
                    });
                } else {
                    await prisma.civilWorkInfo.create({
                        data: {
                            addressId: log.addressId,
                            photos: log.photos || [],
                            performerIds: [userId],
                            completedAt: finalStatus === 'HECHO' ? new Date() : null,
                            startedAt: new Date()
                        }
                    });
                }
            }
        }

        // 3. Process duct logs (street works)
        if (ductLogs && Array.isArray(ductLogs)) {
            for (const log of ductLogs) {
                // Loop through photos to extract GPS EXIF points
                const coordinates = [];
                if (log.photos && Array.isArray(log.photos)) {
                    for (const photoUrl of log.photos) {
                        const gpsData = await extractGpsFromImage(photoUrl);
                        if (gpsData) {
                            coordinates.push(gpsData);
                        }
                    }
                }

                // If coordinates found, sort by timestamp
                if (coordinates.length > 0) {
                    coordinates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                }

                // Retrieve start/end from log, or fallback to first/last EXIF point
                const startLat = log.startLat || (coordinates[0]?.lat || null);
                const startLng = log.startLng || (coordinates[0]?.lng || null);
                const endLat = log.endLat || (coordinates[coordinates.length - 1]?.lat || null);
                const endLng = log.endLng || (coordinates[coordinates.length - 1]?.lng || null);

                await prisma.civilDailyDuctLog.create({
                    data: {
                        reportId: report.id,
                        photos: log.photos || [],
                        comments: log.comments || null,
                        startLat: startLat ? parseFloat(startLat) : null,
                        startLng: startLng ? parseFloat(startLng) : null,
                        endLat: endLat ? parseFloat(endLat) : null,
                        endLng: endLng ? parseFloat(endLng) : null,
                        coordinates: coordinates,
                        distance: log.distance ? parseFloat(log.distance) : null,
                        confirmed: log.confirmed || false
                    }
                });
            }
        }

        res.status(201).json({ message: 'Parte diario enviado correctamente', reportId: report.id });
    } catch (error) {
        console.error('Error submitting daily report:', error);
        res.status(500).json({ message: 'Error al enviar el parte diario' });
    }
};

exports.getDailyReports = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        let queryFilter = {};

        // Subcontractors can only view their own reports
        if (user.role === 'SUBCONTRACTOR' && user.subcontractorId) {
            queryFilter.subcontractorId = user.subcontractorId;
        }

        const reports = await prisma.civilDailyReport.findMany({
            where: queryFilter,
            include: {
                subcontractor: true,
                workLogs: {
                    include: {
                        address: true
                    }
                },
                ductLogs: true
            },
            orderBy: { date: 'desc' }
        });

        res.json(reports);
    } catch (error) {
        console.error('Error fetching daily reports:', error);
        res.status(500).json({ message: 'Error al obtener los partes diarios' });
    }
};

exports.bulkUpdateCivilWorkStatus = async (req, res) => {
    const { addressIds, status } = req.body;
    const userId = req.userId;

    if (!addressIds || !Array.isArray(addressIds) || addressIds.length === 0) {
        return res.status(400).json({ message: 'Se requiere una lista de IDs de acometidas.' });
    }

    if (!status) {
        return res.status(400).json({ message: 'Se requiere el estado.' });
    }

    try {
        await prisma.$transaction(async (tx) => {
            for (const id of addressIds) {
                // Actualizar estado en la dirección física
                await tx.address.update({
                    where: { id },
                    data: { civilWorkStatus: status }
                });

                // Crear o actualizar la información detallada de obra civil
                const existingInfo = await tx.civilWorkInfo.findUnique({ where: { addressId: id } });
                if (existingInfo) {
                    await tx.civilWorkInfo.update({
                        where: { addressId: id },
                        data: {
                            performerIds: { push: userId },
                            completedAt: status === 'HECHO' ? new Date() : undefined
                        }
                    });
                } else {
                    await tx.civilWorkInfo.create({
                        data: {
                            addressId: id,
                            performerIds: [userId],
                            completedAt: status === 'HECHO' ? new Date() : null,
                            startedAt: new Date()
                        }
                    });
                }
            }
        });

        res.json({ message: `Se actualizaron correctamente ${addressIds.length} acometidas.` });
    } catch (error) {
        console.error('Error in bulkUpdateCivilWorkStatus:', error);
        res.status(500).json({ message: 'Error interno al realizar la actualización en lote.' });
    }
};


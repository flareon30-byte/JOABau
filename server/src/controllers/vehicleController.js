const prisma = require('../prisma');
const { sendPushToRole } = require('../utils/notificationUtils');

exports.getAllVehicles = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { isDemo: req.isDemo || false },
            include: { users: true, logs: { take: 5, orderBy: { date: 'desc' } } }
        });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vehicles' });
    }
};

exports.createVehicle = async (req, res) => {
    const { make, model, plate, initialKms, annualKmLimit } = req.body;
    try {
        const vehicle = await prisma.vehicle.create({
            data: {
                make,
                model,
                plate,
                initialKms: parseFloat(initialKms) || 0,
                currentKms: parseFloat(initialKms) || 0,
                annualKmLimit: parseFloat(annualKmLimit) || 10000,
                isDemo: req.isDemo || false
            }
        });
        res.status(201).json(vehicle);
    } catch (error) {
        res.status(500).json({ message: 'Error creating vehicle' });
    }
};

exports.updateVehicle = async (req, res) => {
    const { id } = req.params;
    const { make, model, plate, initialKms, annualKmLimit, currentKms } = req.body;
    try {
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: {
                make,
                model,
                plate,
                initialKms: initialKms !== undefined ? parseFloat(initialKms) : undefined,
                currentKms: currentKms !== undefined ? parseFloat(currentKms) : undefined,
                annualKmLimit: annualKmLimit !== undefined ? parseFloat(annualKmLimit) : undefined
            }
        });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ message: 'Error updating vehicle' });
    }
};

exports.deleteVehicle = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.vehicle.delete({ where: { id } });
        res.json({ message: 'Vehicle deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting vehicle' });
    }
};

// Logs for Technicians
exports.addVehicleLog = async (req, res) => {
    const { vehicleId, type, kms, amount, liters, photos, date } = req.body;
    const userId = req.userId;

    try {
        // Calculate fuel/km details
        const log = await prisma.vehicleLog.create({
            data: {
                vehicleId,
                type,
                kms: kms ? parseFloat(kms) : null,
                amount: amount ? parseFloat(amount) : null,
                liters: liters ? parseFloat(liters) : null,
                photos: photos || [],
                date: date ? new Date(date) : new Date(),
                createdById: userId
            }
        });

        // Update Vehicle current mileage ONLY if the new kms are HIGHER than current ones
        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (kms) {
            if (parseFloat(kms) > vehicle.currentKms) {
                await prisma.vehicle.update({
                    where: { id: vehicleId },
                    data: { currentKms: parseFloat(kms) }
                });
            }
        }

        // --- NEW NOTIFICATION FOR SUPER ADMIN (WRAPPED IN TRY-CATCH) ---
        try {
            const creatingUser = await prisma.user.findUnique({ where: { id: userId } });
            const notificationMsg = `⛽ ${creatingUser.username} ha registrado un ${type === 'FUEL' ? 'Ticket de Gasolina' : 'Log'} para el vehículo ${vehicle.plate} (${amount || 0}€)`;
            
            await prisma.notification.create({
                data: {
                    type: 'VEHICLE_LOG_ADDED',
                    message: notificationMsg,
                    targetRole: 'SUPER_ADMIN'
                }
            });

            sendPushToRole('SUPER_ADMIN', {
                title: '⛽ Nuevo Gasto de Vehículo',
                body: notificationMsg
            }).catch(e => console.error('Push error:', e.message));
        } catch (notifErr) {
            console.error('Non-critical vehicle notification error:', notifErr.message);
        }

        res.status(201).json({ message: 'Log registered', log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering vehicle log' });
    }
};

exports.getVehicleStats = async (req, res) => {
    const { id } = req.params;
    try {
        const vehicle = await prisma.vehicle.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

        // Simple Analytics
        const totalFuelCost = vehicle.logs
            .filter(l => l.type === 'FUEL')
            .reduce((sum, l) => sum + (l.amount || 0), 0);

        const kmsDriven = vehicle.currentKms - vehicle.initialKms;
        const progressToLimit = (kmsDriven / (vehicle.annualKmLimit || 10000)) * 100;

        res.json({
            vehicle,
            stats: {
                totalFuelCost,
                kmsDriven,
                progressToLimit,
                isNearLimit: progressToLimit > 90
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.deleteVehicleLog = async (req, res) => {
    const { id } = req.params;
    try {
        const logToDelete = await prisma.vehicleLog.findUnique({ where: { id } });
        if (!logToDelete) return res.status(404).json({ message: 'Log not found' });

        const vehicleId = logToDelete.vehicleId;

        // 1. Delete the log
        await prisma.vehicleLog.delete({ where: { id } });

        // 2. Recalculate Vehicle currentKms (get the most recent remaining log with Kms)
        const lastValidLog = await prisma.vehicleLog.findFirst({
            where: { 
                vehicleId,
                kms: { not: null }
            },
            orderBy: { kms: 'desc' }
        });

        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        const newCurrentKms = lastValidLog ? lastValidLog.kms : vehicle.initialKms;

        await prisma.vehicle.update({
            where: { id: vehicleId },
            data: { currentKms: newCurrentKms }
        });

        res.json({ success: true, message: 'Log deleted and vehicle kms updated', newCurrentKms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting vehicle log' });
    }
};

exports.updateVehicleLog = async (req, res) => {
    const { id } = req.params;
    const { kms, amount, liters, date } = req.body;

    try {
        const logToUpdate = await prisma.vehicleLog.findUnique({ where: { id } });
        if (!logToUpdate) return res.status(404).json({ message: 'Log not found' });

        const vehicleId = logToUpdate.vehicleId;

        // 1. Update the log
        await prisma.vehicleLog.update({
            where: { id },
            data: {
                kms: kms !== undefined ? parseFloat(kms) : undefined,
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                liters: liters !== undefined ? parseFloat(liters) : undefined,
                date: date ? new Date(date) : undefined
            }
        });

        // 2. Recalculate Vehicle currentKms (get the most recent remaining log with Kms)
        const lastValidLog = await prisma.vehicleLog.findFirst({
            where: { 
                vehicleId,
                kms: { not: null }
            },
            orderBy: { kms: 'desc' }
        });

        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        const newCurrentKms = lastValidLog ? lastValidLog.kms : vehicle.initialKms;

        await prisma.vehicle.update({
            where: { id: vehicleId },
            data: { currentKms: newCurrentKms }
        });

        res.json({ success: true, message: 'Log updated and vehicle kms recalculated', newCurrentKms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating vehicle log' });
    }
};

